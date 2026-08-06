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
    // We must use a transaction for the claim and update
    await prisma.$transaction(async (tx) => {
      // 1. Claim jobs atomically
      const jobs: any[] = await tx.$queryRaw`
        SELECT * FROM notification_jobs 
        WHERE status IN ('PENDING', 'RETRY_PENDING', 'WAITING_FOR_RECEIPTS') 
          AND available_at <= now() 
        LIMIT ${config.WORKER_BATCH_SIZE} 
        FOR UPDATE SKIP LOCKED
      `;

      if (jobs.length === 0) {
        return; // Nothing to do
      }

      logger.info(`📦 Claimed batch of ${jobs.length} jobs.`);

      const jobIds = jobs.map(j => j.id);

      // 2. Update to PROCESSING for all jobs that are not WAITING_FOR_RECEIPTS
      // Note: We don't want to change WAITING_FOR_RECEIPTS back to PROCESSING according to documentation.
      // Wait! The documentation says: 
      // "PROCESSING → WAITING_FOR_RECEIPTS"
      // "WAITING_FOR_RECEIPTS → COMPLETED"
      // Wait, is it OK for a job to remain in WAITING_FOR_RECEIPTS while we process it? 
      // If we don't update it to PROCESSING, another worker won't claim it because it's locked by FOR UPDATE.
      // But we should probably mark its status as PROCESSING or update locked_at.
      // The lifecycle says: 
      // PENDING → PROCESSING
      // RETRY_PENDING → PROCESSING
      // But it does NOT say WAITING_FOR_RECEIPTS -> PROCESSING.
      // So we should only update status='PROCESSING' for jobs that are PENDING or RETRY_PENDING.
      // For WAITING_FOR_RECEIPTS, we just update locked_at = now().
      
      const jobsToProcessing = jobs.filter(j => j.status === 'PENDING' || j.status === 'RETRY_PENDING').map(j => j.id);
      
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

      // 3. Dispatch each job
      for (const job of jobs) {
        // Parse payload since queryRaw returns it as an object or string depending on driver
        const payload = typeof job.payload === 'string' ? JSON.parse(job.payload) : job.payload;
        // Parse ticket_ids if necessary
        const ticketIds = typeof job.ticket_ids === 'string' ? JSON.parse(job.ticket_ids) : job.ticket_ids;
        
        // Map DB columns to camelCase for TS
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
        await dispatchJob(tx, mappedJob);
        endTimer();
      }
    }, {
      timeout: 30000, // 30s max transaction
    });
  } catch (error: any) {
    logger.error({ error: { failure_reason: 'BatchProcessingError', stack: error.stack } }, '❌ Error processing batch');
  }
}
