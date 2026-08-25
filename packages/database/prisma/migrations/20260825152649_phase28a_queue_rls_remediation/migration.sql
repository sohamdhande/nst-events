-- 1. Grant precise column UPDATE privileges to nst_app
GRANT UPDATE (status, attempt_count, last_error, ticket_ids, available_at, updated_at) 
ON notification_jobs TO nst_app;

-- 2. Create strict UPDATE policy for nst_app
CREATE POLICY "System can retry and replay notification jobs" 
ON notification_jobs 
FOR UPDATE 
TO nst_app 
USING (status IN ('FAILED', 'DEAD_LETTER')) 
WITH CHECK (
    status = 'PENDING' 
    AND attempt_count = 0 
    AND last_error IS NULL 
    AND (ticket_ids IS NULL OR ticket_ids = 'null'::jsonb)
);
