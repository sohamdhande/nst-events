-- Hotfix: Add INSERT policy for audit_logs
CREATE POLICY "Allow INSERT on audit_logs" ON "audit_logs"
FOR INSERT TO nst_app
WITH CHECK (
  actor_id = current_user_id()
  OR current_user_id() IS NULL -- Some system actions might not have app.user_id set, e.g. webhooks, but in general, actor_id should match or be system.
);
