-- CreateEnum
CREATE TYPE "NotificationJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'RETRY_PENDING', 'FAILED', 'DEAD_LETTER', 'ARCHIVED');

-- CreateTable
CREATE TABLE "notification_jobs" (
    "id" UUID NOT NULL,
    "status" "NotificationJobStatus" NOT NULL DEFAULT 'PENDING',
    "payload" JSONB NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 4,
    "available_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "locked_at" TIMESTAMPTZ,
    "worker_id" TEXT,
    "idempotency_key" TEXT NOT NULL,
    "last_error" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (Unique Constraint for Idempotency)
CREATE UNIQUE INDEX "notification_jobs_idempotency_key_key" ON "notification_jobs"("idempotency_key");

-- CreateIndex (Polling Index)
CREATE INDEX "idx_notification_jobs_poll" ON "notification_jobs"("status", "available_at") WHERE "status" IN ('PENDING', 'RETRY_PENDING');

-- Constraints
-- Enqueue logic enforces that duplicate idempotency_key inserts are ignored
-- NOTE: Prisma manages the UNIQUE index. We handle DO NOTHING in the application or RPC layer, 
-- but we don't need to add a database trigger for ON CONFLICT.

-- ==========================================
-- ROW LEVEL SECURITY (RLS)
-- ==========================================

ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notification_preferences" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "push_tokens" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notification_jobs" ENABLE ROW LEVEL SECURITY;

-- 1. notifications
CREATE POLICY "Users can view their own notifications" ON "notifications"
FOR SELECT USING (user_id = current_user_id());

CREATE POLICY "Users can update their own notifications" ON "notifications"
FOR UPDATE USING (user_id = current_user_id());

CREATE POLICY "Users can delete their own notifications" ON "notifications"
FOR DELETE USING (user_id = current_user_id());

-- 2. notification_preferences
CREATE POLICY "Users can view their own notification preferences" ON "notification_preferences"
FOR SELECT USING (user_id = current_user_id());

CREATE POLICY "Users can insert their own notification preferences" ON "notification_preferences"
FOR INSERT WITH CHECK (user_id = current_user_id());

CREATE POLICY "Users can update their own notification preferences" ON "notification_preferences"
FOR UPDATE USING (user_id = current_user_id());

-- 3. push_tokens
CREATE POLICY "Users can view their own push tokens" ON "push_tokens"
FOR SELECT USING (user_id = current_user_id());

CREATE POLICY "Users can insert their own push tokens" ON "push_tokens"
FOR INSERT WITH CHECK (user_id = current_user_id());

CREATE POLICY "Users can update their own push tokens" ON "push_tokens"
FOR UPDATE USING (user_id = current_user_id());

CREATE POLICY "Users can delete their own push tokens" ON "push_tokens"
FOR DELETE USING (user_id = current_user_id());

-- 4. notification_jobs
CREATE POLICY "Authenticated users can enqueue jobs" ON "notification_jobs"
FOR INSERT WITH CHECK (current_user_id() IS NOT NULL);

-- ==========================================
-- CRON JOBS
-- ==========================================

-- Cleanup Rule for notification_jobs (7 days retention for COMPLETED and ARCHIVED)
DO $$ 
BEGIN
  PERFORM cron.schedule(
    'cleanup_notification_jobs',
    '0 2 * * *', -- Daily at 02:00 AM UTC
    $cron$DELETE FROM notification_jobs WHERE status IN ('COMPLETED', 'ARCHIVED') AND updated_at < now() - interval '7 days'$cron$
  );
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron not available or schedule failed, skipping cron setup';
END $$;
