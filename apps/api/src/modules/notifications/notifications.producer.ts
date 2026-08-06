import { Prisma } from '@nst/database';
import { createHash } from 'crypto';
import { z } from 'zod';

export const NotificationMetadataSchema = z.object({
  schema_version: z.literal(1),
  routing: z.object({
    target: z.string(),
    fallback: z.string(),
    params: z.record(z.string()),
  }),
  entity_ids: z.object({
    event_id: z.string().uuid().optional(),
    club_id: z.string().uuid().optional(),
    dispute_id: z.string().uuid().optional(),
    attendance_id: z.string().uuid().optional(),
    announcement_id: z.string().uuid().optional(),
  }),
  action_payload: z.object({
    role: z.string().optional(),
    status: z.string().optional(),
  }).optional(),
});

export const ValidNotificationTypesSchema = z.enum([
  'WAITLIST_PROMOTED', 'APPROVAL_REQUEST', 'EVENT_APPROVED', 'EVENT_REJECTED',
  'ATTENDANCE_DISPUTE_RESOLVED', 'ROLE_CHANGED', 'CLUB_ANNOUNCEMENT',
  'SYSTEM_ALERT', 'EVENT_REMINDER', 'ATTENDANCE_ALERT'
]);

export type NotificationMetadata = {
  schema_version: 1;
  routing: {
    target: string;
    fallback: string;
    params: Record<string, string>;
  };
  entity_ids: {
    event_id?: string;
    club_id?: string;
    dispute_id?: string;
    attendance_id?: string;
    announcement_id?: string;
  };
  action_payload?: {
    role?: string;
    status?: string;
  };
};

export type EnqueueParams = {
  tx: Prisma.TransactionClient;
  userId: string;
  type: string;
  title: string;
  body: string;
  metadata: NotificationMetadata;
  preferenceGate: 'push_enabled' | 'club_announcements' | 'event_reminders' | 'attendance_alerts' | 'bypass';
  priority?: 'HIGH' | 'NORMAL';
  idempotencyString: string;
};

export const enqueueNotification = async ({
  tx,
  userId,
  type,
  title,
  body,
  metadata,
  preferenceGate,
  priority = 'NORMAL',
  idempotencyString,
}: EnqueueParams) => {
  // 0. Runtime Validation
  ValidNotificationTypesSchema.parse(type);
  NotificationMetadataSchema.parse(metadata);

  // 1. Enforce preference gates
  let pushEnabled = true;
  if (preferenceGate !== 'bypass') {
    const prefs = await tx.notificationPreference.findUnique({
      where: { userId },
    });
    if (prefs) {
      if (preferenceGate === 'push_enabled') pushEnabled = prefs.pushEnabled;
      else if (preferenceGate === 'club_announcements') pushEnabled = prefs.clubAnnouncements;
      else if (preferenceGate === 'event_reminders') pushEnabled = prefs.eventReminders;
      else if (preferenceGate === 'attendance_alerts') pushEnabled = prefs.attendanceAlerts;
    }
  }

  // 2. Create Inbox Notification
  const notification = await tx.notification.create({
    data: {
      userId,
      title,
      body,
      type,
      metadata: metadata as any,
    },
  });

  // 3. Compute Idempotency Key
  const idempotencyKey = createHash('sha256').update(idempotencyString).digest('hex');

  // 4. Create Queue Job (only if push is enabled, though the worker could also just mark COMPLETED)
  // The architecture says: "Worker... Sends push payload to Expo if push_enabled preferences allow".
  // But step 6 says "Before enqueueing push notifications, enforce the documented preference gates."
  // So if not pushEnabled, we might skip enqueueing or enqueue with a flag. We'll skip enqueueing if push is disabled, saving worker load.
  if (pushEnabled) {
    const payload = {
      schema_version: 1,
      job_type: 'SEND_PUSH',
      notification_type: type,
      notification_id: notification.id, // For worker to update delivered_at
      user_id: userId,
      title,
      body,
      metadata,
      delivery_channel: 'PUSH_AND_INAPP',
    };

    // Use Prisma create (with idempotency conflict ignoring handled by Postgres if unique fails, but Prisma throws P2002)
    // To implement ON CONFLICT DO NOTHING natively in Prisma without throwing, we can use createMany with skipDuplicates
    // OR we can use $executeRaw. Given we have a JsonB payload, $executeRaw is best to ensure ON CONFLICT DO NOTHING.
    await tx.$executeRaw`
      INSERT INTO notification_jobs (
        id, status, payload, priority, attempt_count, max_attempts, 
        available_at, idempotency_key, created_at, updated_at
      )
      VALUES (
        gen_random_uuid(), 'PENDING', ${payload}::jsonb, ${priority}, 0, 4,
        now(), ${idempotencyKey}, now(), now()
      )
      ON CONFLICT (idempotency_key) DO NOTHING;
    `;
  }

  return notification;
};
