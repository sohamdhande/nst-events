-- 1. Modify process_waitlist to handle both INDIVIDUAL and TEAM registrations natively.
CREATE OR REPLACE FUNCTION public.process_waitlist(p_event_id uuid)
 RETURNS uuid[]
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_promoted_ids UUID[] := ARRAY[]::UUID[];
  v_team RECORD;
  v_individual RECORD;
  v_member_ids UUID[];
  v_capacity_left INT;
  v_event events;
BEGIN
  -- Re-read event capacity to ensure we don't violate bounds
  SELECT * INTO v_event FROM events WHERE id = p_event_id FOR UPDATE;

  IF v_event.registration_type = 'INDIVIDUAL' THEN
    LOOP
      -- Calculate capacity left
      IF v_event.max_capacity IS NULL THEN
        v_capacity_left := 999999;
      ELSE
        v_capacity_left := v_event.max_capacity - v_event.registration_count;
      END IF;

      IF v_capacity_left <= 0 THEN
        EXIT;
      END IF;

      -- Find the oldest waitlisted individual
      SELECT er.id, er.user_id
      INTO v_individual
      FROM event_registrations er
      WHERE er.event_id = p_event_id 
        AND er.registration_status = 'WAITLISTED'
        AND er.deleted_at IS NULL
        AND er.team_id IS NULL
      ORDER BY er.registered_at ASC, er.id ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED;

      IF NOT FOUND THEN
        EXIT;
      END IF;

      -- Promote the individual
      UPDATE event_registrations 
      SET 
        registration_status = 'REGISTERED', 
        eligibility_scope_snapshot = v_event.audience, 
        academic_batch_id_snapshot = CASE WHEN v_event.audience = 'SPECIFIC_BATCHES' THEN (SELECT batch_id FROM user_academic_profiles WHERE user_id = event_registrations.user_id) ELSE NULL END 
      WHERE id = v_individual.id;
      
      v_promoted_ids := array_append(v_promoted_ids, v_individual.user_id);
      
      -- Update event registration count locally
      v_event.registration_count := v_event.registration_count + 1;
      UPDATE events SET registration_count = v_event.registration_count WHERE id = p_event_id;
    END LOOP;

  ELSIF v_event.registration_type = 'TEAM' THEN
    LOOP
      -- Calculate capacity left
      IF v_event.max_capacity IS NULL THEN
        v_capacity_left := 999999;
      ELSE
        v_capacity_left := v_event.max_capacity - v_event.registration_count;
      END IF;

      IF v_capacity_left <= 0 THEN
        EXIT;
      END IF;

      -- Find the oldest waitlisted team
      SELECT t.id, (
          SELECT count(*) FROM event_registrations er 
          WHERE er.team_id = t.id AND er.deleted_at IS NULL
      ) as member_count
      INTO v_team
      FROM teams t
      WHERE t.event_id = p_event_id 
        AND t.status = 'WAITLISTED'
        AND t.deleted_at IS NULL
      ORDER BY (
          SELECT min(er.registered_at) FROM event_registrations er 
          WHERE er.team_id = t.id AND er.deleted_at IS NULL
      ) ASC, t.id ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED;

      IF NOT FOUND THEN
        EXIT;
      END IF;

      -- Does this entire team fit?
      IF v_team.member_count <= v_capacity_left THEN
        -- Promote the team
        UPDATE teams SET status = 'REGISTERED' WHERE id = v_team.id;
        
        UPDATE event_registrations 
        SET 
          registration_status = 'REGISTERED', 
          eligibility_scope_snapshot = v_event.audience, 
          academic_batch_id_snapshot = CASE WHEN v_event.audience = 'SPECIFIC_BATCHES' THEN (SELECT batch_id FROM user_academic_profiles WHERE user_id = event_registrations.user_id) ELSE NULL END 
        WHERE team_id = v_team.id AND deleted_at IS NULL;
        
        -- Add team members to promoted list
        SELECT array_agg(user_id) INTO v_member_ids
        FROM event_registrations 
        WHERE team_id = v_team.id AND deleted_at IS NULL;
        
        v_promoted_ids := array_cat(v_promoted_ids, v_member_ids);
        
        -- Update event registration count locally
        v_event.registration_count := v_event.registration_count + v_team.member_count;
        UPDATE events SET registration_count = v_event.registration_count WHERE id = p_event_id;
      ELSE
        -- Team does not fit, we stop promoting (no partial, no leapfrogging)
        EXIT;
      END IF;
    END LOOP;
  END IF;
  
  RETURN v_promoted_ids;
END;
$function$;

-- 2. Fix cancel_registration bug where RETURNING * caused process_waitlist to never be invoked
CREATE OR REPLACE FUNCTION cancel_registration(p_event_id UUID, p_user_id UUID)
RETURNS UUID[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_caller_id UUID := current_user_id();
  v_reg event_registrations;
  v_promoted UUID[] := ARRAY[]::UUID[];
  v_new_count INT;
BEGIN
  IF v_caller_id != p_user_id AND NOT EXISTS (
    SELECT 1 FROM users WHERE id = v_caller_id AND global_role IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN')
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  PERFORM 1 FROM events WHERE id = p_event_id FOR UPDATE;

  SELECT * INTO v_reg FROM event_registrations 
  WHERE event_id = p_event_id AND user_id = p_user_id AND deleted_at IS NULL;

  IF NOT FOUND THEN RAISE EXCEPTION 'Registration not found'; END IF;

  UPDATE event_registrations 
  SET deleted_at = now(), registration_status = 'CANCELLED' 
  WHERE id = v_reg.id;

  IF v_reg.registration_status = 'REGISTERED' THEN
    UPDATE events SET registration_count = registration_count - 1 WHERE id = p_event_id;
    v_promoted := process_waitlist(p_event_id);
    SELECT registration_count INTO v_new_count FROM events WHERE id = p_event_id;
    PERFORM emit_event_live_update(p_event_id, 'registration_count', jsonb_build_object('count', v_new_count));
  END IF;

  RETURN v_promoted;
END;
$$;
