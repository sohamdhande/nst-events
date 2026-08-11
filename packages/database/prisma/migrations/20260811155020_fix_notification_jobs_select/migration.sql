CREATE POLICY "System can read notification jobs" ON notification_jobs FOR SELECT TO nst_app USING (true);
