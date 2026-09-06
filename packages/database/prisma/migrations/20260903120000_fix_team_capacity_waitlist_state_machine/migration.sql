-- Migration: 20260903120000_fix_team_capacity_waitlist_state_machine
-- Purpose: Fix Event Capacity semantics for TEAM events (1 team = 1 capacity slot) and ensure process_waitlist/cancel_team/leave_team/create_team/join_team adhere to backend-authoritative state machine rules.

-- 1. Fix process_waitlist to treat 1 team = 1 event capacity slot
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
      -- Calculate capacity left (1 team = 1 slot)
      IF v_event.max_capacity IS NULL THEN
        v_capacity_left := 999999;
      ELSE
        v_capacity_left := v_event.max_capacity - v_event.registration_count;
      END IF;

      IF v_capacity_left <= 0 THEN
        EXIT;
      END IF;

      -- Find the oldest waitlisted team
      SELECT t.id
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

      -- Promote the team (1 team consumes 1 capacity slot)
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
      
      -- Update event registration count by +1 team slot
      v_event.registration_count := v_event.registration_count + 1;
      UPDATE events SET registration_count = v_event.registration_count WHERE id = p_event_id;
    END LOOP;
  END IF;
  
  RETURN v_promoted_ids;
END;
$function$;

-- 2. Fix cancel_team to release 1 team capacity slot and trigger waitlist promotion
CREATE OR REPLACE FUNCTION cancel_team(p_event_id UUID, p_team_id UUID)
RETURNS UUID[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_caller_id UUID := current_user_id();
  v_team teams;
  v_event events;
  v_promoted UUID[] := ARRAY[]::UUID[];
BEGIN
  SELECT * INTO v_event FROM events WHERE id = p_event_id FOR UPDATE;
  IF v_event.is_locked = true OR now() >= v_event.end_time + interval '24 hours' THEN 
    RAISE EXCEPTION 'Event is locked' USING ERRCODE = 'U0030'; 
  END IF;

  SELECT * INTO v_team FROM teams WHERE id = p_team_id AND event_id = p_event_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Team not found' USING ERRCODE = 'U0034'; END IF;

  -- Ensure caller is authorized (Leader or Admin)
  IF v_caller_id != v_team.leader_id AND NOT EXISTS (
    SELECT 1 FROM users WHERE id = v_caller_id AND global_role IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN')
  ) THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = 'U0001';
  END IF;

  IF v_team.status = 'REGISTERED' THEN
    -- Release 1 team slot
    UPDATE events SET registration_count = GREATEST(0, registration_count - 1) WHERE id = p_event_id;
  END IF;

  UPDATE teams SET status = 'CANCELLED', deleted_at = now() WHERE id = p_team_id;
  UPDATE event_registrations SET deleted_at = now(), registration_status = 'CANCELLED' WHERE team_id = p_team_id AND deleted_at IS NULL;

  IF v_team.status = 'REGISTERED' THEN
    v_promoted := process_waitlist(p_event_id);
  END IF;

  RETURN v_promoted;
END;
$$;

-- 3. Fix leave_team so member leaving does not release capacity or demote team from REGISTERED to WAITLISTED
CREATE OR REPLACE FUNCTION leave_team(p_event_id UUID, p_team_id UUID, p_user_id UUID)
RETURNS UUID[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_caller_id UUID := current_user_id();
  v_team teams;
  v_event events;
  v_promoted UUID[] := ARRAY[]::UUID[];
BEGIN
  IF v_caller_id != p_user_id AND NOT EXISTS (
    SELECT 1 FROM users WHERE id = v_caller_id AND global_role IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN')
  ) THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = 'U0001';
  END IF;

  SELECT * INTO v_event FROM events WHERE id = p_event_id FOR UPDATE;
  IF v_event.is_locked = true OR now() >= v_event.end_time + interval '24 hours' THEN 
    RAISE EXCEPTION 'Event is locked' USING ERRCODE = 'U0030'; 
  END IF;

  SELECT * INTO v_team FROM teams WHERE id = p_team_id AND event_id = p_event_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Team not found' USING ERRCODE = 'U0034'; END IF;

  IF v_team.leader_id = p_user_id THEN
    -- Leader leaving dissolves the entire team
    IF v_team.status = 'REGISTERED' THEN
      UPDATE events SET registration_count = GREATEST(0, registration_count - 1) WHERE id = p_event_id;
    END IF;

    UPDATE teams SET status = 'CANCELLED', deleted_at = now() WHERE id = p_team_id;
    UPDATE event_registrations SET deleted_at = now(), registration_status = 'CANCELLED' WHERE team_id = p_team_id AND deleted_at IS NULL;
    
    INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, new_state)
    VALUES (v_caller_id, 'TEAM_CANCELLED_BY_LEADER', 'TEAM', p_team_id, jsonb_build_object('team_id', p_team_id));
    
    IF v_team.status = 'REGISTERED' THEN
      v_promoted := process_waitlist(p_event_id);
    END IF;

    RETURN v_promoted;
  END IF;

  UPDATE event_registrations SET deleted_at = now(), registration_status = 'CANCELLED' 
  WHERE team_id = p_team_id AND user_id = p_user_id AND deleted_at IS NULL;

  IF NOT FOUND THEN RAISE EXCEPTION 'Member not found in team' USING ERRCODE = 'U0039'; END IF;

  -- A member leaving a registered team does NOT release an event capacity slot,
  -- and does NOT demote a REGISTERED team to WAITLISTED. The team remains REGISTERED.
  RETURN v_promoted;
END;
$$;

-- 4. Update create_team to evaluate minimum team size and event capacity immediately
CREATE OR REPLACE FUNCTION public.create_team(p_event_id uuid, p_name text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_caller_id UUID := current_user_id();
  v_team teams;
  v_reg event_registrations;
  v_event events;
  v_normalized_name TEXT := lower(trim(p_name));
  v_min_team_size INT;
  v_initial_status TEXT := 'FORMING';
  v_reg_status TEXT := 'WAITLISTED';
BEGIN
  IF v_caller_id IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;

  SELECT * INTO v_event FROM events WHERE id = p_event_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Event not found'; END IF;
  IF v_event.state != 'PUBLISHED' THEN RAISE EXCEPTION 'Event not published'; END IF;
  IF v_event.registration_type != 'TEAM' THEN RAISE EXCEPTION 'Event does not support teams'; END IF;
  IF v_event.is_locked = true OR now() >= v_event.end_time + interval '24 hours' THEN 
    RAISE EXCEPTION 'Event is locked' USING ERRCODE = 'U0030'; 
  END IF;

  -- ENFORCE: Registration Eligibility
  IF v_event.audience = 'SPECIFIC_BATCHES' THEN
    IF NOT EXISTS (
      SELECT 1 FROM user_academic_profiles uap
      JOIN event_audience_batches eab ON eab.batch_id = uap.batch_id
      WHERE uap.user_id = v_caller_id AND eab.event_id = p_event_id
    ) THEN
      RAISE EXCEPTION 'ACADEMICALLY_INELIGIBLE' USING ERRCODE = 'U0031';
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM event_registrations WHERE event_id = p_event_id AND user_id = v_caller_id AND registration_status != 'CANCELLED') THEN
    RAISE EXCEPTION 'Already in a team for this event.' USING ERRCODE = 'U0020';
  END IF;

  -- ENFORCE: Team Name Uniqueness
  IF EXISTS (SELECT 1 FROM teams WHERE event_id = p_event_id AND normalized_name = v_normalized_name) THEN
    RAISE EXCEPTION 'TEAM_NAME_TAKEN' USING ERRCODE = 'U0055';
  END IF;

  v_min_team_size := COALESCE((v_event.metadata->>'minimum_team_size')::INT, 1);

  -- Initial team size with leader is 1
  IF 1 >= v_min_team_size THEN
    -- Minimum satisfied on creation
    IF v_event.max_capacity IS NULL OR v_event.registration_count < v_event.max_capacity THEN
      v_initial_status := 'REGISTERED';
      v_reg_status := 'REGISTERED';
      UPDATE events SET registration_count = registration_count + 1 WHERE id = p_event_id;
    ELSE
      v_initial_status := 'WAITLISTED';
      v_reg_status := 'WAITLISTED';
    END IF;
  ELSE
    v_initial_status := 'FORMING';
    v_reg_status := 'WAITLISTED';
  END IF;

  BEGIN
    INSERT INTO teams (id, event_id, name, normalized_name, leader_id, status)
    VALUES (gen_random_uuid(), p_event_id, p_name, v_normalized_name, v_caller_id, v_initial_status::"TeamStatus")
    RETURNING * INTO v_team;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'TEAM_NAME_TAKEN' USING ERRCODE = 'U0055';
  END;

  INSERT INTO event_registrations (id, event_id, user_id, team_id, registration_status, eligibility_scope_snapshot, academic_batch_id_snapshot)
  VALUES (
    gen_random_uuid(), p_event_id, v_caller_id, v_team.id, v_reg_status::"RegistrationStatus",
    CASE WHEN v_reg_status = 'REGISTERED' THEN v_event.audience ELSE NULL END,
    CASE WHEN v_reg_status = 'REGISTERED' AND v_event.audience = 'SPECIFIC_BATCHES' THEN (SELECT batch_id FROM user_academic_profiles WHERE user_id = v_caller_id) ELSE NULL END
  )
  RETURNING * INTO v_reg;

  RETURN json_build_object('team_id', v_team.id, 'status', v_initial_status, 'registration_id', v_reg.id);
END;
$function$;


-- 5. Update join_team to handle FORMING -> REGISTERED / WAITLISTED transitions and prevent extra capacity increments for REGISTERED teams
CREATE OR REPLACE FUNCTION public.join_team(p_event_id uuid, p_team_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_caller_id UUID := current_user_id();
  v_reg event_registrations;
  v_event events;
  v_team teams;
  v_team_size INT;
  v_team_size_max INT;
  v_team_size_min INT;
BEGIN
  IF v_caller_id IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;

  SELECT * INTO v_event FROM events WHERE id = p_event_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Event not found'; END IF;
  IF v_event.state != 'PUBLISHED' THEN RAISE EXCEPTION 'Event not published'; END IF;
  IF v_event.registration_type != 'TEAM' THEN RAISE EXCEPTION 'Event does not support teams'; END IF;
  IF v_event.is_locked = true OR now() >= v_event.end_time + interval '24 hours' THEN 
    RAISE EXCEPTION 'Event is locked' USING ERRCODE = 'U0006'; 
  END IF;

  -- ENFORCE: Registration Eligibility
  IF v_event.audience = 'SPECIFIC_BATCHES' THEN
    IF NOT EXISTS (
      SELECT 1 FROM user_academic_profiles uap
      JOIN event_audience_batches eab ON eab.batch_id = uap.batch_id
      WHERE uap.user_id = v_caller_id AND eab.event_id = p_event_id
    ) THEN
      RAISE EXCEPTION 'ACADEMICALLY_INELIGIBLE' USING ERRCODE = 'U0013';
    END IF;
  END IF;

  SELECT * INTO v_team FROM teams WHERE id = p_team_id AND event_id = p_event_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Team not found'; END IF;
  IF v_team.status = 'CANCELLED' THEN RAISE EXCEPTION 'Team is cancelled'; END IF;

  -- Ensure user not already registered
  PERFORM 1 FROM event_registrations 
  WHERE event_id = p_event_id AND user_id = v_caller_id AND deleted_at IS NULL;
  IF FOUND THEN RAISE EXCEPTION 'Already in a team'; END IF;

  v_team_size_max := (v_event.metadata->>'maximum_team_size')::INT;
  v_team_size_min := COALESCE((v_event.metadata->>'minimum_team_size')::INT, 1);

  SELECT count(*) INTO v_team_size FROM event_registrations WHERE team_id = p_team_id AND deleted_at IS NULL;
  IF v_team_size_max IS NOT NULL AND v_team_size >= v_team_size_max THEN
    RAISE EXCEPTION 'Team is full';
  END IF;

  v_team_size := v_team_size + 1;

  IF v_team.status = 'FORMING' THEN
    IF v_team_size >= v_team_size_min THEN
      -- Minimum reached, try to secure 1 team capacity slot
      IF v_event.max_capacity IS NULL OR v_event.registration_count < v_event.max_capacity THEN
        UPDATE teams SET status = 'REGISTERED' WHERE id = p_team_id;
        UPDATE event_registrations SET registration_status = 'REGISTERED', eligibility_scope_snapshot = v_event.audience, academic_batch_id_snapshot = CASE WHEN v_event.audience = 'SPECIFIC_BATCHES' THEN (SELECT batch_id FROM user_academic_profiles WHERE user_id = event_registrations.user_id) ELSE NULL END WHERE team_id = p_team_id AND deleted_at IS NULL;
        UPDATE events SET registration_count = registration_count + 1 WHERE id = p_event_id;
        
        INSERT INTO event_registrations (id, event_id, user_id, team_id, registration_status, eligibility_scope_snapshot, academic_batch_id_snapshot)
        VALUES (gen_random_uuid(), p_event_id, v_caller_id, p_team_id, 'REGISTERED', v_event.audience, CASE WHEN v_event.audience = 'SPECIFIC_BATCHES' THEN (SELECT batch_id FROM user_academic_profiles WHERE user_id = v_caller_id) ELSE NULL END) RETURNING * INTO v_reg;
        RETURN json_build_object('registration_id', v_reg.id, 'status', 'REGISTERED');
      ELSE
        UPDATE teams SET status = 'WAITLISTED' WHERE id = p_team_id;
        INSERT INTO event_registrations (id, event_id, user_id, team_id, registration_status)
        VALUES (gen_random_uuid(), p_event_id, v_caller_id, p_team_id, 'WAITLISTED') RETURNING * INTO v_reg;
        RETURN json_build_object('registration_id', v_reg.id, 'status', 'WAITLISTED');
      END IF;
    ELSE
      -- Still FORMING
      INSERT INTO event_registrations (id, event_id, user_id, team_id, registration_status)
      VALUES (gen_random_uuid(), p_event_id, v_caller_id, p_team_id, 'WAITLISTED') RETURNING * INTO v_reg;
      RETURN json_build_object('registration_id', v_reg.id, 'status', 'FORMING');
    END IF;
  ELSIF v_team.status = 'REGISTERED' THEN
    -- Team already has 1 capacity slot, do not increment registration_count
    INSERT INTO event_registrations (id, event_id, user_id, team_id, registration_status, eligibility_scope_snapshot, academic_batch_id_snapshot)
    VALUES (gen_random_uuid(), p_event_id, v_caller_id, p_team_id, 'REGISTERED', v_event.audience, CASE WHEN v_event.audience = 'SPECIFIC_BATCHES' THEN (SELECT batch_id FROM user_academic_profiles WHERE user_id = v_caller_id) ELSE NULL END) RETURNING * INTO v_reg;
    RETURN json_build_object('registration_id', v_reg.id, 'status', 'REGISTERED');
  ELSE
    -- WAITLISTED
    INSERT INTO event_registrations (id, event_id, user_id, team_id, registration_status)
    VALUES (gen_random_uuid(), p_event_id, v_caller_id, p_team_id, 'WAITLISTED') RETURNING * INTO v_reg;
    RETURN json_build_object('registration_id', v_reg.id, 'status', 'WAITLISTED');
  END IF;
END;
$function$;
