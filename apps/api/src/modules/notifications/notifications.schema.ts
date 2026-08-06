import { z } from 'zod';

export const GetNotificationsQuerySchema = z.object({
  query: z.object({
    cursor: z.string().uuid().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    filter_read: z
      .string()
      .transform((val) => val === 'true')
      .optional(),
  }),
});

export const UpdatePreferencesSchema = z.object({
  body: z.object({
    push_enabled: z.boolean().optional(),
    event_reminders: z.boolean().optional(),
    club_announcements: z.boolean().optional(),
    attendance_alerts: z.boolean().optional(),
  }),
});
