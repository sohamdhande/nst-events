import { executePush } from './jobs/sendPush';
import { executeReceiptPolling } from './jobs/receiptPolling';
import { logger } from './lib/logger';
import { handleDeadLetter } from './jobs/retry';
import { z } from 'zod';

const basePayloadSchema = z.object({
  job_type: z.enum(['SEND_PUSH']),
  user_id: z.string().uuid(),
}).passthrough();

export async function dispatchJob(tx: any, job: any) {
  try {
    basePayloadSchema.parse(job.payload);
  } catch (err: any) {
    logger.error({ job_id: job.id, status: job.status, error: { failure_reason: 'InvalidPayloadSchema', details: err.errors } }, `❌ Job ${job.id} has malformed payload. Routing to DEAD_LETTER.`);
    await handleDeadLetter(tx, job, `Malformed payload: ${err.message}`);
    return;
  }

  const jobType = job.payload?.job_type;

  try {
    switch (jobType) {
      case 'SEND_PUSH':
        switch (job.status) {
          case 'PENDING':
          case 'RETRY_PENDING':
          case 'PROCESSING':
            await executePush(tx, job);
            break;
          case 'WAITING_FOR_RECEIPTS':
            await executeReceiptPolling(tx, job);
            break;
          default:
            logger.error({ job_id: job.id, status: job.status, notification_type: jobType, error: { failure_reason: 'InvalidJobStatus' } }, `❌ Job ${job.id} has invalid status ${job.status} for job_type ${jobType}.`);
            await markJobFailed(tx, job, `Invalid status ${job.status} for SEND_PUSH`);
            break;
        }
        break;
      default:
        logger.error({ job_id: job.id, status: job.status, notification_type: jobType, error: { failure_reason: 'UnknownJobType' } }, `❌ Job ${job.id} has unknown job_type: ${jobType}`);
        await markJobFailed(tx, job, `Unknown job_type: ${jobType}`);
        break;
    }
  } catch (error: any) {
    logger.error({ job_id: job.id, status: job.status, error: { failure_reason: 'UnhandledDispatchError', stack: error.stack } }, `❌ Unhandled error dispatching job ${job.id}`);
    await markJobFailed(tx, job, `Unhandled error: ${error.message}`);
  }
}

async function markJobFailed(tx: any, job: any, reason: string) {
  await tx.$executeRaw`
    UPDATE notification_jobs
    SET status = 'FAILED', last_error = ${reason}, ticket_ids = NULL, updated_at = now()
    WHERE id = ${job.id}::uuid
  `;
}
