CREATE POLICY "System can insert notification jobs" ON notification_jobs FOR INSERT TO nst_app WITH CHECK (true);
