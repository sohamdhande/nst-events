import { z } from 'zod';

export const QueueJobsQuerySchema = z.object({
  query: z.object({
    cursor: z.string().uuid().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    filter_status: z.enum(['PENDING', 'PROCESSING', 'WAITING_FOR_RECEIPTS', 'COMPLETED', 'RETRY_PENDING', 'FAILED', 'DEAD_LETTER', 'ARCHIVED']).optional(),
    filter_notification_type: z.string().optional(),
    filter_user_id: z.string().uuid().optional(),
    filter_created_after: z.string().datetime().optional(),
    filter_created_before: z.string().datetime().optional(),
  })
});

export const DeadLetterQuerySchema = z.object({
  query: z.object({
    cursor: z.string().uuid().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    filter_notification_type: z.string().optional(),
    filter_user_id: z.string().uuid().optional(),
    filter_created_after: z.string().datetime().optional(),
    filter_created_before: z.string().datetime().optional(),
  })
});
