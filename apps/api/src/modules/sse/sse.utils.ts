import { z } from 'zod';
import { UnprocessableEntityError } from '../../lib/errors';

const uuidSchema = z.string().uuid();

/**
 * Validates an eventId as a strict UUID and constructs the canonical PostgreSQL LISTEN channel.
 * This prevents SQL injection attacks against the unparameterizable LISTEN command.
 */
export function buildEventChannel(eventId: string): string {
  const result = uuidSchema.safeParse(eventId);
  if (!result.success) {
    throw new UnprocessableEntityError('Invalid event ID format');
  }
  
  return `event_${result.data}_live`;
}

/**
 * Validates a userId as a strict UUID and constructs the canonical PostgreSQL LISTEN channel for user notifications.
 */
export function buildUserNotificationChannel(userId: string): string {
  const result = uuidSchema.safeParse(userId);
  if (!result.success) {
    throw new UnprocessableEntityError('Invalid user ID format');
  }
  
  return `user_${result.data}_notifications_live`;
}
