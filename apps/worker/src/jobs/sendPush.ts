import { expo } from '../index';
import { Expo, ExpoPushMessage } from 'expo-server-sdk';
import { handleTransientError, handlePermanentError, handleArchived } from './retry';
import { config } from '../config';
import { logger } from '../lib/logger';
import { expoApiErrorsTotal, jobsProcessedTotal } from '../lib/metrics';

export async function executePush(tx: any, job: any) {
  const userId = job.payload.user_id;
  
  if (!userId) {
    return handlePermanentError(tx, job, 'Missing user_id in payload');
  }

  // 1. Fetch user and check if entity is deleted
  const user = await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId}::uuid`;
  if (user.length === 0) {
    return handleArchived(tx, job, `User ${userId} deleted`);
  }

  // 2. Fetch active push tokens for user
  const tokens: any[] = await tx.$queryRaw`SELECT expo_token FROM push_tokens WHERE user_id = ${userId}::uuid`;
  
  if (tokens.length === 0) {
    logger.info({ job_id: job.id, user_id: userId, status: 'COMPLETED' }, `ℹ️ No push tokens for user ${userId}. Job ${job.id} completed silently.`);
    jobsProcessedTotal.labels({ status: 'COMPLETED', notification_type: job.payload?.job_type || 'unknown' }).inc();
    await tx.$executeRaw`
      UPDATE notification_jobs
      SET status = 'COMPLETED', updated_at = now()
      WHERE id = ${job.id}::uuid
    `;
    return;
  }

  // Construct message
  const messages: ExpoPushMessage[] = tokens.map(t => ({
    to: t.expo_token,
    sound: 'default',
    title: job.payload.title,
    body: job.payload.body,
    data: job.payload.metadata || {},
  }));

  // Chunk messages
  const chunks = expo.chunkPushNotifications(messages);
  const ticketMap: Record<string, string> = {};
  const errors: string[] = [];
  let isRateExceeded = false;
  let isMessageTooBig = false;
  let isInvalidCredentials = false;
  let isDeviceNotRegistered = false;

  // Send chunks
  for (const chunk of chunks) {
    try {
      const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
      for (let i = 0; i < ticketChunk.length; i++) {
        const ticket = ticketChunk[i];
        const token = chunk[i].to as string;
        
        if (ticket.status === 'ok') {
          ticketMap[ticket.id] = token;
        } else {
          expoApiErrorsTotal.labels({ error_code: ticket.details?.error || 'Unknown' }).inc();
          // Expo returned error in ticket (e.g. DeviceNotRegistered)
          // But wait, ticket errors in push send are rare, usually they come in receipts.
          // Still, we record them.
          errors.push(ticket.message || ticket.details?.error || 'Unknown ticket error');
          
          // Check for permanent errors returned synchronously
          if (ticket.details?.error === 'DeviceNotRegistered') {
            isDeviceNotRegistered = true;
          } else if (ticket.details?.error === 'MessageTooBig') {
            isMessageTooBig = true;
          } else if (ticket.details?.error === 'InvalidCredentials') {
            isInvalidCredentials = true;
          }
        }
      }
    } catch (error: any) {
      expoApiErrorsTotal.labels({ error_code: 'network_timeout' }).inc();
      logger.error({ job_id: job.id, error: { failure_reason: 'ExpoSendError', stack: error.stack } }, `Expo send error for job ${job.id}`);
      errors.push(error.message);
      if (error.code === 'PUSH_TOO_MANY_EXPERIENCE_IDS') {
         // Not explicitly documented in failure matrix, treat as transient
      }
    }
  }

  if (isDeviceNotRegistered) {
    return handlePermanentError(tx, job, 'DeviceNotRegistered');
  }
  if (isMessageTooBig) {
    return handlePermanentError(tx, job, 'MessageTooBig');
  }
  if (isInvalidCredentials) {
    return handlePermanentError(tx, job, 'InvalidCredentials');
  }

  if (Object.keys(ticketMap).length > 0) {
    // Partial or total success. Store ticket map and transition to WAITING_FOR_RECEIPTS
    logger.info({ job_id: job.id, status: 'WAITING_FOR_RECEIPTS', tickets_count: Object.keys(ticketMap).length }, `✅ Sent push for job ${job.id}, received ${Object.keys(ticketMap).length} tickets. Transitioning to WAITING_FOR_RECEIPTS.`);
    
    // We stringify the tickets JSON
    const ticketsJson = JSON.stringify(ticketMap);

    await tx.$executeRaw`
      UPDATE notification_jobs
      SET status = 'WAITING_FOR_RECEIPTS', 
          ticket_ids = ${ticketsJson}::jsonb, 
          available_at = now() + interval '1 minute' * ${config.EXPO_RECEIPT_DELAY_MINUTES},
          updated_at = now()
      WHERE id = ${job.id}::uuid
    `;
  } else if (errors.length > 0) {
    // Total failure (Transient)
    const errString = errors.join(', ');
    if (errString.includes('network') || errString.includes('timeout') || errString.includes('429') || errString.includes('500') || errString.includes('502')) {
      return handleTransientError(tx, job, errString);
    }
    // Default to transient for unknown network errors from Expo
    return handleTransientError(tx, job, errString);
  } else {
    // Edge case: no tickets, no errors, but tokens existed? Should not happen.
    return handlePermanentError(tx, job, 'Unknown failure: No tickets and no errors returned.');
  }
}
