-- Phase 12 Backend Hardening - Audit Logs RLS
-- Enables RLS on audit_logs and adds a SELECT policy for admins. No INSERT policy is needed since writes use SECURITY DEFINER.

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow SELECT on audit_logs" ON audit_logs;
CREATE POLICY "Allow SELECT on audit_logs" ON audit_logs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users u WHERE u.id = current_user_id() AND u.global_role IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN'))
  );
