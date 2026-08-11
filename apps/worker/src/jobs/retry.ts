import { config } from '../config';
import { logger } from '../lib/logger';
import { jobsProcessedTotal } from '../lib/metrics';

export function calculateBackoff(attemptCount: number): number {
  switch (attemptCount) {
    case 1:
      return 30 * 1000; // 30s
    case 2:
      return 2 * 60 * 1000; // 2m
    case 3:
      return 10 * 60 * 1000; // 10m
    default:
      return 10 * 60 * 1000; // Cap at 10m
  }
}

export async function handleTransientError(tx: any, job: any, errorMsg: string) {
  const newAttemptCount = job.attemptCount + 1;

  if (newAttemptCount > config.WORKER_MAX_RETRIES) {
    await handleDeadLetter(tx, job, errorMsg);
  } else {
    // Transition to RETRY_PENDING
    const backoffMs = calculateBackoff(newAttemptCount);
    logger.warn({ job_id: job.id, status: 'RETRY_PENDING', attempt_count: newAttemptCount, error: { failure_reason: errorMsg } }, `⏳ Job ${job.id} transient failure. Retrying in ${backoffMs}ms (Attempt ${newAttemptCount}).`);
    await tx.$executeRaw`
      UPDATE notification_jobs
      SET status = 'RETRY_PENDING', 
          attempt_count = ${newAttemptCount}, 
          available_at = now() + interval '1 millisecond' * ${backoffMs},
          last_error = ${errorMsg},
          ticket_ids = NULL,
          updated_at = now()
      WHERE id = ${job.id}::uuid
    `;
  }
}

export async function handlePermanentError(tx: any, job: any, errorMsg: string) {
  logger.error({ job_id: job.id, status: 'FAILED', error: { failure_reason: errorMsg } }, `❌ Job ${job.id} permanent failure. Transitioning to FAILED.`);
  jobsProcessedTotal.labels({ status: 'FAILED', notification_type: job.payload?.job_type || 'unknown' }).inc();
  await tx.$executeRaw`
    UPDATE notification_jobs
    SET status = 'FAILED', last_error = ${errorMsg}, ticket_ids = NULL, updated_at = now()
    WHERE id = ${job.id}::uuid
  `;
}

export async function handleArchived(tx: any, job: any, reason: string) {
  logger.info({ job_id: job.id, status: 'ARCHIVED', error: { failure_reason: reason } }, `📁 Job ${job.id} archived`);
  jobsProcessedTotal.labels({ status: 'ARCHIVED', notification_type: job.payload?.job_type || 'unknown' }).inc();
  await tx.$executeRaw`
    UPDATE notification_jobs
    SET status = 'ARCHIVED', last_error = ${reason}, ticket_ids = NULL, updated_at = now()
    WHERE id = ${job.id}::uuid
  `;
}

export async function handleDeadLetter(tx: any, job: any, errorMsg: string) {
  logger.error({ job_id: job.id, status: 'DEAD_LETTER', error: { failure_reason: errorMsg } }, `💀 Job ${job.id} transitioning to DEAD_LETTER.`);
  jobsProcessedTotal.labels({ status: 'DEAD_LETTER', notification_type: job.payload?.job_type || 'unknown' }).inc();
  await tx.$executeRaw`
    UPDATE notification_jobs
    SET status = 'DEAD_LETTER', last_error = ${errorMsg}, ticket_ids = NULL, updated_at = now()
    WHERE id = ${job.id}::uuid
  `;
}
