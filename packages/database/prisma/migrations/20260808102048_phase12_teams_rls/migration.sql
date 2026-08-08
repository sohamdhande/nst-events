-- Phase 12 Backend Hardening - Teams RLS Bypass
-- Grants PLATFORM_ADMIN the ability to UPDATE and DELETE teams, bypassing the leader_id check.

DROP POLICY IF EXISTS "Allow UPDATE on teams" ON teams;
CREATE POLICY "Allow UPDATE on teams" ON teams
  FOR UPDATE USING (
    leader_id = current_user_id()
    OR 
    EXISTS (SELECT 1 FROM users u WHERE u.id = current_user_id() AND u.global_role = 'PLATFORM_ADMIN')
  ) WITH CHECK (
    leader_id = current_user_id()
    OR 
    EXISTS (SELECT 1 FROM users u WHERE u.id = current_user_id() AND u.global_role = 'PLATFORM_ADMIN')
  );

DROP POLICY IF EXISTS "Allow DELETE on teams" ON teams;
CREATE POLICY "Allow DELETE on teams" ON teams
  FOR DELETE USING (
    leader_id = current_user_id()
    OR 
    EXISTS (SELECT 1 FROM users u WHERE u.id = current_user_id() AND u.global_role = 'PLATFORM_ADMIN')
  );
