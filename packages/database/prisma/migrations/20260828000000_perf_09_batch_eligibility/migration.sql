CREATE OR REPLACE FUNCTION public.is_users_available_for_team(
    p_event_id uuid,
    p_team_id uuid,
    p_target_user_ids uuid[]
) RETURNS TABLE (
    user_id uuid,
    is_available boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
    v_caller_id uuid := current_user_id();
    v_max_size int;
    v_current_size int;
    v_is_locked boolean;
    v_end_time timestamptz;
    v_event_valid boolean := true;
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
        v_event_valid := false;
    END IF;

    -- 2. Verify Event Lock and Team Maximum Size
    IF v_event_valid THEN
        SELECT 
            is_locked, 
            end_time,
            (metadata->>'maximum_team_size')::int
        INTO v_is_locked, v_end_time, v_max_size
        FROM public.events
        WHERE id = p_event_id AND state = 'PUBLISHED' AND deleted_at IS NULL;

        IF NOT FOUND THEN 
            v_event_valid := false;
        ELSIF v_is_locked OR now() >= v_end_time + interval '24 hours' THEN 
            v_event_valid := false;
        ELSE
            IF v_max_size IS NOT NULL THEN
                SELECT count(*) INTO v_current_size
                FROM public.event_registrations
                WHERE team_id = p_team_id AND deleted_at IS NULL;
                
                IF v_current_size >= v_max_size THEN 
                    v_event_valid := false;
                END IF;
            END IF;
        END IF;
    END IF;

    RETURN QUERY
    SELECT 
        u.target_id,
        CASE 
            WHEN NOT v_event_valid THEN false
            -- 3. Reject if target is already an active member of ANY team for this event
            WHEN EXISTS (
                SELECT 1 FROM public.event_registrations er
                WHERE er.event_id = p_event_id
                  AND er.user_id = u.target_id
                  AND er.deleted_at IS NULL
            ) THEN false
            -- 4. Reject if target has an active pending invitation for THIS event
            WHEN EXISTS (
                SELECT 1 FROM public.team_invitations ti
                JOIN public.teams t ON t.id = ti.team_id
                WHERE ti.invitee_id = u.target_id
                  AND ti.status = 'PENDING'
                  AND ti.expires_at > now()
                  AND t.event_id = p_event_id
                  AND t.deleted_at IS NULL
            ) THEN false
            ELSE true
        END AS is_available
    FROM unnest(p_target_user_ids) AS u(target_id);
END;
$function$;
