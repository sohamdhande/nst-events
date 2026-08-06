import { expo } from '../index';
import { handleTransientError, handlePermanentError } from './retry';
import { logger } from '../lib/logger';
import { expoApiErrorsTotal, jobsProcessedTotal } from '../lib/metrics';

export async function executeReceiptPolling(tx: any, job: any) {
  const ticketMap = job.ticket_ids;
  
  if (!ticketMap || typeof ticketMap !== 'object' || Object.keys(ticketMap).length === 0) {
    // Edge case: WAITING_FOR_RECEIPTS but no tickets. 
    // Complete it and clear tickets.
    return completeJob(tx, job);
  }

  const ticketIds = Object.keys(ticketMap);
  const receiptIdChunks = expo.chunkPushNotificationReceiptIds(ticketIds);
  let hasTransientFailure = false;
  let transientErrorMsg = '';
  
  for (const chunk of receiptIdChunks) {
    try {
      const receipts = await expo.getPushNotificationReceiptsAsync(chunk);
      
      for (const receiptId in receipts) {
        const receipt = receipts[receiptId];
        
        if (receipt.status === 'ok') {
          // Success
          continue;
        } else if (receipt.status === 'error') {
          expoApiErrorsTotal.labels({ error_code: receipt.details?.error || 'Unknown' }).inc();
          logger.error({ job_id: job.id, receipt_id: receiptId, error: { failure_reason: 'ExpoReceiptError', message: receipt.message } }, `Expo receipt error for receipt ${receiptId}`);
          
          if (receipt.details && receipt.details.error) {
            const errCode = receipt.details.error;
            
            if (errCode === 'DeviceNotRegistered') {
              const token = ticketMap[receiptId];
              if (token) {
                logger.info({ job_id: job.id, receipt_id: receiptId, token }, `🗑️ Expo DeviceNotRegistered: Deleting token`);
                await tx.$executeRaw`DELETE FROM push_tokens WHERE expo_token = ${token}`;
              }
              return handlePermanentError(tx, job, 'DeviceNotRegistered');
            } else if (errCode === 'MessageTooBig' || errCode === 'InvalidCredentials') {
              return handlePermanentError(tx, job, errCode);
            } else {
              // Other error, treat as transient
              hasTransientFailure = true;
              transientErrorMsg = errCode;
            }
          }
        }
      }
    } catch (error: any) {
      expoApiErrorsTotal.labels({ error_code: 'network_timeout' }).inc();
      logger.error({ job_id: job.id, error: { failure_reason: 'ExpoReceiptNetworkError', stack: error.stack } }, `Expo receipt network error for job ${job.id}`);
      hasTransientFailure = true;
      transientErrorMsg = error.message;
    }
  }

  if (hasTransientFailure) {
    // If a transient failure occurred during receipt polling, we transition to RETRY_PENDING.
    // The dual-axis dispatch logic will subsequently re-execute executePush.
    // The documentation specifies to clear ticket_ids whenever leaving WAITING_FOR_RECEIPTS.
    return handleTransientError(tx, job, transientErrorMsg);
  }

  // If we processed all receipts and there were no fatal errors that aborted early:
  await completeJob(tx, job);
}

async function completeJob(tx: any, job: any) {
  logger.info({ job_id: job.id, status: 'COMPLETED' }, `🎉 Job ${job.id} completed receipt polling successfully.`);
  jobsProcessedTotal.labels({ status: 'COMPLETED', notification_type: job.payload?.job_type || 'unknown' }).inc();
  await tx.$executeRaw`
    UPDATE notification_jobs
    SET status = 'COMPLETED', ticket_ids = NULL, updated_at = now()
    WHERE id = ${job.id}::uuid
  `;

  // Stamp delivered_at on the notification row
  const notificationId = job.payload?.notification_id;
  if (notificationId) {
    await tx.$executeRaw`
      UPDATE notifications
      SET delivered_at = now()
      WHERE id = ${notificationId}::uuid
    `;
  }
}
