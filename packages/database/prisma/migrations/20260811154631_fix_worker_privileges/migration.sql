-- Fix notifications INSERT for API
CREATE POLICY "System can insert notifications" ON notifications FOR INSERT TO nst_app WITH CHECK (true);

-- Fix push_tokens column privilege (needs user_id for WHERE clause)
GRANT SELECT (user_id) ON push_tokens TO nst_worker;

-- Fix notification_jobs column privilege (missing job_type if it is queried?)
-- Actually, the worker does SELECT * inside the transaction for FOR UPDATE SKIP LOCKED
GRANT SELECT ON notification_jobs TO nst_worker;

