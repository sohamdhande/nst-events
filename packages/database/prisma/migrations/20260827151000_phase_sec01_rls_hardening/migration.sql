-- Ensure nst_app role has correct attributes
ALTER ROLE nst_app NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION;

-- Force RLS on all sensitive tables
ALTER TABLE "users" FORCE ROW LEVEL SECURITY;
ALTER TABLE "refresh_tokens" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "refresh_tokens" FORCE ROW LEVEL SECURITY;
ALTER TABLE "clubs" FORCE ROW LEVEL SECURITY;
ALTER TABLE "club_memberships" FORCE ROW LEVEL SECURITY;
ALTER TABLE "events" FORCE ROW LEVEL SECURITY;
ALTER TABLE "event_clubs" FORCE ROW LEVEL SECURITY;
ALTER TABLE "teams" FORCE ROW LEVEL SECURITY;
ALTER TABLE "event_registrations" FORCE ROW LEVEL SECURITY;
ALTER TABLE "team_invitations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "team_invitations" FORCE ROW LEVEL SECURITY;
ALTER TABLE "attendance_sessions" FORCE ROW LEVEL SECURITY;
ALTER TABLE "attendance_records" FORCE ROW LEVEL SECURITY;
ALTER TABLE "attendance_disputes" FORCE ROW LEVEL SECURITY;
ALTER TABLE "announcements" FORCE ROW LEVEL SECURITY;
ALTER TABLE "leadership_handover_requests" FORCE ROW LEVEL SECURITY;
ALTER TABLE "leaderboard_scores" FORCE ROW LEVEL SECURITY;
ALTER TABLE "audit_logs" FORCE ROW LEVEL SECURITY;
ALTER TABLE "push_tokens" FORCE ROW LEVEL SECURITY;
ALTER TABLE "notifications" FORCE ROW LEVEL SECURITY;
ALTER TABLE "notification_preferences" FORCE ROW LEVEL SECURITY;
ALTER TABLE "notification_jobs" FORCE ROW LEVEL SECURITY;

ALTER TABLE "authorized_students" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "authorized_students" FORCE ROW LEVEL SECURITY;
ALTER TABLE "user_academic_profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "user_academic_profiles" FORCE ROW LEVEL SECURITY;

-- 4. Write missing policies

-- refresh_tokens: server-only. The application logic strictly controls lookup by token_hash.
CREATE POLICY "Allow server ALL on refresh_tokens" ON "refresh_tokens"
FOR ALL TO nst_app USING (true) WITH CHECK (true);

-- authorized_students: pre-login read access is required for domain verification in loginWithGoogle.
-- Mutations are PLATFORM_ADMIN only.
CREATE POLICY "Allow server SELECT on authorized_students" ON "authorized_students"
FOR SELECT TO nst_app USING (true);

CREATE POLICY "Allow platform admin ALL on authorized_students" ON "authorized_students"
FOR ALL TO nst_app
USING (current_user_global_role() = 'PLATFORM_ADMIN')
WITH CHECK (current_user_global_role() = 'PLATFORM_ADMIN');

-- user_academic_profiles: users can read their own. Admin can read all. Admin can mutate all.
CREATE POLICY "Allow users SELECT own user_academic_profiles" ON "user_academic_profiles"
FOR SELECT TO nst_app USING (user_id = current_user_id());

CREATE POLICY "Allow users INSERT own user_academic_profiles" ON "user_academic_profiles"
FOR INSERT TO nst_app WITH CHECK (user_id = current_user_id());

CREATE POLICY "Allow admins ALL on user_academic_profiles" ON "user_academic_profiles"
FOR ALL TO nst_app 
USING (current_user_global_role() = ANY (ARRAY['PLATFORM_ADMIN', 'FACULTY_ADMIN']))
WITH CHECK (current_user_global_role() = ANY (ARRAY['PLATFORM_ADMIN', 'FACULTY_ADMIN']));

-- team_invitations
CREATE POLICY "Allow SELECT on team_invitations" ON "team_invitations"
FOR SELECT TO nst_app USING (
  invitee_id = current_user_id() OR
  EXISTS (SELECT 1 FROM teams WHERE teams.id = team_invitations.team_id AND teams.leader_id = current_user_id()) OR
  EXISTS (SELECT 1 FROM teams t JOIN event_clubs ec ON t.event_id = ec.event_id WHERE t.id = team_invitations.team_id AND has_club_role(ec.club_id, current_user_id(), ARRAY['CLUB_ADMIN'::text, 'FACULTY_MENTOR'::text])) OR
  current_user_global_role() = ANY(ARRAY['PLATFORM_ADMIN', 'FACULTY_ADMIN'])
);

CREATE POLICY "Allow INSERT on team_invitations" ON "team_invitations"
FOR INSERT TO nst_app WITH CHECK (
  EXISTS (SELECT 1 FROM teams WHERE teams.id = team_id AND teams.leader_id = current_user_id())
);

CREATE POLICY "Allow UPDATE on team_invitations" ON "team_invitations"
FOR UPDATE TO nst_app USING (
  invitee_id = current_user_id() OR
  EXISTS (SELECT 1 FROM teams WHERE teams.id = team_invitations.team_id AND teams.leader_id = current_user_id())
) WITH CHECK (
  invitee_id = current_user_id() OR
  EXISTS (SELECT 1 FROM teams WHERE teams.id = team_invitations.team_id AND teams.leader_id = current_user_id())
);

CREATE POLICY "Allow DELETE on team_invitations" ON "team_invitations"
FOR DELETE TO nst_app USING (
  invitee_id = current_user_id() OR
  EXISTS (SELECT 1 FROM teams WHERE teams.id = team_invitations.team_id AND teams.leader_id = current_user_id())
);

-- 5. Set search_path to safe values on SECURITY DEFINER functions that only had 'public'
ALTER FUNCTION public.manual_mark_attendance(uuid, uuid) SET search_path TO 'public', 'pg_catalog';
ALTER FUNCTION public.prevent_global_role_escalation() SET search_path TO 'public', 'pg_catalog';
