DROP POLICY IF EXISTS "Worker system access to notifications" ON notifications;
CREATE POLICY "Worker system access to notifications" ON notifications FOR ALL TO nst_worker USING (true) WITH CHECK (true);
