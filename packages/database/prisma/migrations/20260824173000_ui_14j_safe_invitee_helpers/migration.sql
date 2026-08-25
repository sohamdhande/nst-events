-- 1. Helper for safe team membership access
CREATE OR REPLACE FUNCTION public.get_team_member_ids(
    p_event_id uuid,
    p_team_id uuid
) RETURNS TABLE(user_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_id uuid := current_user_id();
BEGIN
    -- Verify the team belongs to the event and the requesting user is a member/leader
    IF NOT EXISTS (
        SELECT 1 FROM public.teams t
        LEFT JOIN public.event_registrations er ON er.team_id = t.id AND er.user_id = v_caller_id AND er.deleted_at IS NULL
        WHERE t.id = p_team_id
          AND t.event_id = p_event_id
          AND t.deleted_at IS NULL
          AND (t.leader_id = v_caller_id OR er.id IS NOT NULL)
    ) THEN
        RETURN;
    END IF;

    -- Return only the user_ids of active team members
    RETURN QUERY
    SELECT er.user_id
    FROM public.event_registrations er
    WHERE er.team_id = p_team_id
      AND er.event_id = p_event_id
      AND er.deleted_at IS NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.get_team_member_ids(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_team_member_ids(uuid, uuid) TO nst_app;


-- 2. Helper to determine if a target user is available for a team
CREATE OR REPLACE FUNCTION public.is_user_available_for_team(
    p_event_id uuid,
    p_team_id uuid,
    p_target_user_id uuid
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_id uuid := current_user_id();
    v_max_size int;
    v_current_size int;
    v_is_locked boolean;
    v_end_time timestamptz;
BEGIN
    -- 1. Verify caller is leader/member of the requesting team
    IF NOT EXISTS (
        SELECT 1 FROM public.teams t
        LEFT JOIN public.event_registrations er ON er.team_id = t.id AND er.user_id = v_caller_id AND er.deleted_at IS NULL
        WHERE t.id = p_team_id
          AND t.event_id = p_event_id
          AND t.deleted_at IS NULL
          AND (t.leader_id = v_caller_id OR er.id IS NOT NULL)
    ) THEN
        RETURN FALSE;
    END IF;

    -- 2. Verify Event Lock and Team Maximum Size
    SELECT 
        is_locked, 
        end_time,
        (metadata->>'maximum_team_size')::int
    INTO v_is_locked, v_end_time, v_max_size
    FROM public.events
    WHERE id = p_event_id AND state = 'PUBLISHED' AND deleted_at IS NULL;

    IF NOT FOUND THEN RETURN FALSE; END IF;
    IF v_is_locked OR now() >= v_end_time + interval '24 hours' THEN RETURN FALSE; END IF;

    IF v_max_size IS NOT NULL THEN
        SELECT count(*) INTO v_current_size
        FROM public.event_registrations
        WHERE team_id = p_team_id AND deleted_at IS NULL;
        
        IF v_current_size >= v_max_size THEN RETURN FALSE; END IF;
    END IF;

    -- 3. Reject if target is already an active member of ANY team for this event
    IF EXISTS (
        SELECT 1 FROM public.event_registrations
        WHERE event_id = p_event_id
          AND user_id = p_target_user_id
          AND deleted_at IS NULL
    ) THEN
        RETURN FALSE;
    END IF;

    -- 4. Reject if target has an active pending invitation for THIS event
    IF EXISTS (
        SELECT 1 FROM public.team_invitations ti
        JOIN public.teams t ON t.id = ti.team_id
        WHERE ti.invitee_id = p_target_user_id
          AND ti.status = 'PENDING'
          AND ti.expires_at > now()
          AND t.event_id = p_event_id
          AND t.deleted_at IS NULL
    ) THEN
        RETURN FALSE;
    END IF;

    RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.is_user_available_for_team(uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_user_available_for_team(uuid, uuid, uuid) TO nst_app;
