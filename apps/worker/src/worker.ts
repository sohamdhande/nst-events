import { prisma } from './index';
import { config } from './config';
import { dispatchJob } from './dispatcher';
import { logger } from './lib/logger';
import { processingDuration } from './lib/metrics';

export let isShuttingDown = false;
let activeBatchPromise: Promise<void> | null = null;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function startWorkerLoop() {
  logger.info('🔄 Worker polling loop started.');

  while (!isShuttingDown) {
    activeBatchPromise = processBatch();
    await activeBatchPromise;
    activeBatchPromise = null;

    if (!isShuttingDown) {
      await sleep(config.WORKER_POLL_INTERVAL_MS);
    }
  }
}

export async function stopWorkerLoop() {
  isShuttingDown = true;
  if (activeBatchPromise) {
    logger.info(`⏳ Waiting up to ${config.WORKER_SHUTDOWN_TIMEOUT_MS}ms for active batch to finish...`);
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Shutdown timeout')), config.WORKER_SHUTDOWN_TIMEOUT_MS)
    );
    try {
      await Promise.race([activeBatchPromise, timeoutPromise]);
      logger.info('✅ Active batch finished cleanly.');
    } catch (e: any) {
      logger.warn({ error: { failure_reason: 'ShutdownTimeout', stack: e.stack } }, '⚠️ Active batch did not finish within timeout or threw an error');
    }
  }
}

export async function processBatch() {
  try {
    let claimedJobs: any[] = [];

    // 1. Claim jobs atomically in a brief transaction
    await prisma.$transaction(async (tx) => {
      const jobs: any[] = await tx.$queryRaw`
        SELECT * FROM notification_jobs 
        WHERE 
          (status IN ('PENDING', 'RETRY_PENDING') AND available_at <= now())
          OR (status = 'PROCESSING' AND locked_at <= now() - interval '5 minutes')
          OR (status = 'WAITING_FOR_RECEIPTS' AND available_at <= now())
        LIMIT ${config.WORKER_BATCH_SIZE} 
        FOR UPDATE SKIP LOCKED
      `;

      if (jobs.length === 0) {
        return; // Nothing to do
      }

      logger.info(`📦 Claimed batch of ${jobs.length} jobs.`);

      const jobsToProcessing = jobs.filter(j => j.status === 'PENDING' || j.status === 'RETRY_PENDING' || j.status === 'PROCESSING').map(j => j.id);
      
      if (jobsToProcessing.length > 0) {
        await tx.notificationJob.updateMany({
          where: { id: { in: jobsToProcessing } },
          data: { status: 'PROCESSING', lockedAt: new Date(), updatedAt: new Date() }
        });
      }
      
      const jobsToWait = jobs.filter(j => j.status === 'WAITING_FOR_RECEIPTS').map(j => j.id);
      if (jobsToWait.length > 0) {
        await tx.notificationJob.updateMany({
          where: { id: { in: jobsToWait } },
          data: { lockedAt: new Date(), updatedAt: new Date() }
        });
      }

      claimedJobs = jobs;
    }, {
      timeout: 10000, // Fast transaction just for claiming
    });

    if (claimedJobs.length === 0) {
      return;
    }

    // 2. Dispatch each job OUTSIDE the claim transaction
    for (const job of claimedJobs) {
      const payload = typeof job.payload === 'string' ? JSON.parse(job.payload) : job.payload;
      const ticketIds = typeof job.ticket_ids === 'string' ? JSON.parse(job.ticket_ids) : job.ticket_ids;
      
      const mappedJob = {
        ...job,
        payload,
        ticket_ids: ticketIds,
        attemptCount: job.attempt_count,
        maxAttempts: job.max_attempts,
        availableAt: job.available_at,
        lastError: job.last_error,
        idempotencyKey: job.idempotency_key,
      };
      
      const endTimer = processingDuration.labels({ job_type: payload?.job_type || 'unknown' }).startTimer();
      // We pass prisma instead of tx so individual jobs can run their own state-update transactions
      await dispatchJob(prisma, mappedJob);
      endTimer();
    }
  } catch (error: any) {
    logger.error({ error: { failure_reason: 'BatchProcessingError', stack: error.stack } }, '❌ Error processing batch');
  }
}
