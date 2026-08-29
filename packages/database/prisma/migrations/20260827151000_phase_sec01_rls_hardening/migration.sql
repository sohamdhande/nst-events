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

-- refresh_tokens: scoped securely
CREATE POLICY "Allow users to read own refresh_tokens" ON "refresh_tokens"
FOR SELECT TO nst_app USING (user_id = current_user_id());

CREATE POLICY "Allow users to insert own refresh_tokens" ON "refresh_tokens"
FOR INSERT TO nst_app WITH CHECK (user_id = current_user_id());

CREATE POLICY "Allow users to update own refresh_tokens" ON "refresh_tokens"
FOR UPDATE TO nst_app USING (user_id = current_user_id()) WITH CHECK (user_id = current_user_id());

-- authorized_students: mutations are PLATFORM_ADMIN only
CREATE POLICY "Allow platform admin ALL on authorized_students" ON "authorized_students"
FOR ALL TO nst_app
USING (current_user_global_role() = 'PLATFORM_ADMIN')
WITH CHECK (current_user_global_role() = 'PLATFORM_ADMIN');

-- user_academic_profiles: users can read their own. Admin can read all. Admin can mutate all.
CREATE POLICY "Allow users SELECT own user_academic_profiles" ON "user_academic_profiles"
FOR SELECT TO nst_app USING (user_id = current_user_id());

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

-- 5. New Narrow SECURITY DEFINER Functions for Pre-Auth

CREATE OR REPLACE FUNCTION public.lookup_authorized_student(p_normalized_email text)
RETURNS TABLE (status "DirectoryStatus")
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $$
BEGIN
  RETURN QUERY
  SELECT a.status FROM authorized_students a WHERE a.normalized_email = p_normalized_email LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.lookup_authorized_student(text) TO nst_app;

CREATE OR REPLACE FUNCTION public.lookup_refresh_token(p_token_hash text)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  family_id uuid,
  expires_at timestamptz,
  revoked_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $$
BEGIN
  RETURN QUERY
  SELECT r.id, r.user_id, r.family_id, r.expires_at, r.revoked_at
  FROM refresh_tokens r
  WHERE r.token_hash = p_token_hash
  FOR UPDATE LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.lookup_refresh_token(text) TO nst_app;

CREATE OR REPLACE FUNCTION public.revoke_refresh_token_by_hash(p_token_hash text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $$
BEGIN
  UPDATE refresh_tokens
  SET revoked_at = now()
  WHERE token_hash = p_token_hash AND revoked_at IS NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.revoke_refresh_token_by_hash(text) TO nst_app;

CREATE OR REPLACE FUNCTION public.revoke_refresh_token_family(p_family_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $$
BEGIN
  UPDATE refresh_tokens
  SET revoked_at = now()
  WHERE family_id = p_family_id AND revoked_at IS NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.revoke_refresh_token_family(uuid) TO nst_app;

CREATE OR REPLACE FUNCTION public.increment_user_security_version(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $$
BEGIN
  UPDATE users SET security_version = security_version + 1 WHERE id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_user_security_version(uuid) TO nst_app;

DROP FUNCTION IF EXISTS public.upsert_oauth_user(text, text, text);
CREATE OR REPLACE FUNCTION public.upsert_oauth_user(
  p_google_sub TEXT,
  p_email TEXT,
  p_full_name TEXT
)
RETURNS SETOF users
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $$
DECLARE
  v_role "GlobalRole" := 'STUDENT'::"GlobalRole";
BEGIN
  IF p_email LIKE '%@newtonschool.co' THEN
    v_role := 'FACULTY_MENTOR'::"GlobalRole";
  END IF;

  RETURN QUERY
  INSERT INTO users (id, google_sub, email, full_name, global_role)
  VALUES (gen_random_uuid(), p_google_sub, p_email, p_full_name, v_role)
  ON CONFLICT (google_sub) DO UPDATE
  SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    updated_at = NOW()
  WHERE users.deleted_at IS NULL
  RETURNING *;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_oauth_user(text, text, text) TO nst_app;

-- 6. Harden existing SECURITY DEFINER search_paths
ALTER FUNCTION public.sync_offline_attendance(uuid, jsonb) SET search_path TO 'public', 'pg_catalog';
ALTER FUNCTION public.review_flagged_attendance(uuid) SET search_path TO 'public', 'pg_catalog';
ALTER FUNCTION public.register_event(uuid) SET search_path TO 'public', 'pg_catalog';
ALTER FUNCTION public.sync_offline_attendance(jsonb) SET search_path TO 'public', 'pg_catalog';
ALTER FUNCTION public.create_team(uuid, text) SET search_path TO 'public', 'pg_catalog';
ALTER FUNCTION public.join_team(uuid, uuid) SET search_path TO 'public', 'pg_catalog';
ALTER FUNCTION public.accept_invitation(uuid, uuid, uuid) SET search_path TO 'public', 'pg_catalog';
ALTER FUNCTION public.process_waitlist(uuid) SET search_path TO 'public', 'pg_catalog';
ALTER FUNCTION public.cancel_team(uuid, uuid) SET search_path TO 'public', 'pg_catalog';
ALTER FUNCTION public.leave_team(uuid, uuid, uuid) SET search_path TO 'public', 'pg_catalog';
ALTER FUNCTION public.transfer_leadership(uuid, uuid, uuid) SET search_path TO 'public', 'pg_catalog';
ALTER FUNCTION public.get_team_member_ids(uuid, uuid) SET search_path TO 'public', 'pg_catalog';
ALTER FUNCTION public.is_user_available_for_team(uuid, uuid, uuid) SET search_path TO 'public', 'pg_catalog';
ALTER FUNCTION public.submit_event_for_approval(uuid) SET search_path TO 'public', 'pg_catalog';
ALTER FUNCTION public.approve_event(uuid) SET search_path TO 'public', 'pg_catalog';
ALTER FUNCTION public.reject_event(uuid, text) SET search_path TO 'public', 'pg_catalog';
ALTER FUNCTION public.unlock_event(uuid) SET search_path TO 'public', 'pg_catalog';
ALTER FUNCTION public.check_attendance_eligibility(uuid, uuid) SET search_path TO 'public', 'pg_catalog';
ALTER FUNCTION public.lock_event(uuid) SET search_path TO 'public', 'pg_catalog';
ALTER FUNCTION public.resolve_attendance_dispute(uuid, text, text) SET search_path TO 'public', 'pg_catalog';
ALTER FUNCTION public.submit_attendance_dispute(uuid, text, text[]) SET search_path TO 'public', 'pg_catalog';
ALTER FUNCTION public.cancel_registration(uuid, uuid) SET search_path TO 'public', 'pg_catalog';
ALTER FUNCTION public.emit_event_live_update(uuid, text, jsonb) SET search_path TO 'public', 'pg_catalog';
ALTER FUNCTION public.get_session_qr_context(uuid) SET search_path TO 'public', 'pg_catalog';
ALTER FUNCTION public.is_active_club_member(uuid, uuid) SET search_path TO 'public', 'pg_catalog';
ALTER FUNCTION public.has_club_role(uuid, uuid, text[]) SET search_path TO 'public', 'pg_catalog';
ALTER FUNCTION public.mark_attendance(uuid, text, double precision, double precision, text, text, double precision, boolean, text) SET search_path TO 'public', 'pg_catalog';
ALTER FUNCTION public.current_user_global_role() SET search_path TO 'public', 'pg_catalog';
ALTER FUNCTION public.manual_mark_attendance(uuid, uuid) SET search_path TO 'public', 'pg_catalog';
ALTER FUNCTION public.prevent_global_role_escalation() SET search_path TO 'public', 'pg_catalog';
ALTER FUNCTION public.can_see_user_as_organizer(uuid) SET search_path TO 'public', 'pg_catalog';
ALTER FUNCTION public.audit_club_membership_changes() SET search_path TO 'public', 'pg_catalog';
ALTER FUNCTION public.audit_attendance_records_changes() SET search_path TO 'public', 'pg_catalog';
