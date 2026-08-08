-- Create indexes for worker notification polling to prevent full table scans

CREATE INDEX IF NOT EXISTS "idx_notification_jobs_poll" 
ON "notification_jobs" ("status", "available_at") 
WHERE "status" IN ('PENDING', 'RETRY_PENDING', 'WAITING_FOR_RECEIPTS');

CREATE INDEX IF NOT EXISTS "idx_notification_jobs_processing" 
ON "notification_jobs" ("status", "locked_at") 
WHERE "status" = 'PROCESSING';
