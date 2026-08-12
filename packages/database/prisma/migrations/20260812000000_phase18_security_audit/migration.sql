-- 1. REVOKE TEMP
REVOKE TEMP ON DATABASE nst_events FROM PUBLIC;

-- 2. Worker Least Privilege
REVOKE SELECT ON users FROM nst_worker;
GRANT SELECT (id, deleted_at) ON users TO nst_worker;

-- 3. Hardening SECURITY DEFINER Functions with search_path

-- We must iterate over all 26 functions, but here we enforce search_path explicitly for the 5 vulnerable ones and others that are missing it.
-- Actually, the prompt says: "For every SECURITY DEFINER function that needs protection, establish a fixed trusted search_path."
-- There are 5 functions that lack search_path, and 21 that have search_path=public. We should set search_path='public, pg_catalog' for ALL.

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT p.proname, pg_get_function_identity_arguments(p.oid) as args
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE p.prosecdef = true AND n.nspname = 'public'
    LOOP
        EXECUTE 'ALTER FUNCTION public.' || r.proname || '(' || r.args || ') SET search_path = public, pg_catalog;';
    END LOOP;
END
$$;

-- 4. Schema Qualify Vulnerable Functions

CREATE OR REPLACE FUNCTION public.current_user_global_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $function$
  SELECT global_role::text FROM public.users WHERE id = public.current_user_id();
$function$;

CREATE OR REPLACE FUNCTION public.can_see_user_as_organizer(target_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.event_clubs ec
    JOIN public.club_memberships cm ON ec.club_id = cm.club_id
    WHERE cm.user_id = public.current_user_id()
    AND cm.role IN ('CLUB_ADMIN', 'CORE_MEMBER', 'FACULTY_MENTOR')
    AND (
        EXISTS (
            SELECT 1 FROM public.event_registrations er
            WHERE er.event_id = ec.event_id
            AND er.user_id = target_user_id
        )
        OR EXISTS (
            SELECT 1 FROM public.attendance_sessions asess
            JOIN public.attendance_records ar ON ar.session_id = asess.id
            WHERE asess.event_id = ec.event_id
            AND ar.user_id = target_user_id
        )
    )
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.emit_event_live_update(p_event_id uuid, p_type text, p_payload jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $function$
BEGIN
  PERFORM pg_catalog.pg_notify(
    'event_' || p_event_id || '_live',
    json_build_object('type', p_type, 'payload', p_payload)::text
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.audit_club_membership_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $function$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, previous_state, ip_address, created_at)
    VALUES (public.current_user_id(), 'DELETE', 'club_membership', OLD.id, row_to_json(OLD)::jsonb, null, now());
    RETURN OLD;
  ELSIF (TG_OP = 'UPDATE') THEN
    INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, previous_state, new_state, ip_address, created_at)
    VALUES (public.current_user_id(), 'UPDATE', 'club_membership', NEW.id, row_to_json(OLD)::jsonb, row_to_json(NEW)::jsonb, null, now());
    RETURN NEW;
  ELSIF (TG_OP = 'INSERT') THEN
    INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, new_state, ip_address, created_at)
    VALUES (public.current_user_id(), 'INSERT', 'club_membership', NEW.id, row_to_json(NEW)::jsonb, null, now());
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.audit_attendance_records_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $function$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, previous_state, ip_address, created_at)
    VALUES (public.current_user_id(), 'DELETE', 'attendance_record', OLD.id, row_to_json(OLD)::jsonb, null, now());
    RETURN OLD;
  ELSIF (TG_OP = 'UPDATE') THEN
    INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, previous_state, new_state, ip_address, created_at)
    VALUES (public.current_user_id(), 'UPDATE', 'attendance_record', NEW.id, row_to_json(OLD)::jsonb, row_to_json(NEW)::jsonb, null, now());
    RETURN NEW;
  ELSIF (TG_OP = 'INSERT') THEN
    INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, new_state, ip_address, created_at)
    VALUES (public.current_user_id(), 'INSERT', 'attendance_record', NEW.id, row_to_json(NEW)::jsonb, null, now());
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$function$;

-- 5. RLS on leadership_handover_requests
ALTER TABLE public.leadership_handover_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read for club admins, faculty, platform admins, and participants" ON public.leadership_handover_requests
  FOR SELECT TO nst_app
  USING (
    public.current_user_global_role() IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN') OR
    initiated_by = (public.current_user_id())::uuid OR
    successor_id = (public.current_user_id())::uuid OR
    public.has_club_role(club_id, (public.current_user_id())::uuid, ARRAY['CLUB_ADMIN', 'FACULTY_MENTOR'])
  );

CREATE POLICY "Enable insert for club admins" ON public.leadership_handover_requests
  FOR INSERT TO nst_app
  WITH CHECK (
    public.has_club_role(club_id, (public.current_user_id())::uuid, ARRAY['CLUB_ADMIN'])
  );

CREATE POLICY "Enable update for participants and mentors" ON public.leadership_handover_requests
  FOR UPDATE TO nst_app
  USING (
    public.current_user_global_role() IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN') OR
    initiated_by = (public.current_user_id())::uuid OR
    successor_id = (public.current_user_id())::uuid OR
    public.has_club_role(club_id, (public.current_user_id())::uuid, ARRAY['FACULTY_MENTOR'])
  );

-- 6. RLS on announcements
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read for all authenticated users" ON public.announcements
  FOR SELECT TO nst_app
  USING (true);

CREATE POLICY "Enable insert for club admins and platform admins" ON public.announcements
  FOR INSERT TO nst_app
  WITH CHECK (
    public.current_user_global_role() IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN') OR
    (club_id IS NOT NULL AND public.has_club_role(club_id, (public.current_user_id())::uuid, ARRAY['CLUB_ADMIN', 'FACULTY_MENTOR']))
  );

CREATE POLICY "Enable update/delete for creator and admins" ON public.announcements
  FOR UPDATE TO nst_app
  USING (
    created_by = (public.current_user_id())::uuid OR
    public.current_user_global_role() IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN')
  );

CREATE POLICY "Enable delete for creator and admins" ON public.announcements
  FOR DELETE TO nst_app
  USING (
    created_by = (public.current_user_id())::uuid OR
    public.current_user_global_role() IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN')
  );
