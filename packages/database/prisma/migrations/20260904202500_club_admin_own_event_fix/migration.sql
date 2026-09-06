-- Fix Club Admin Own-Event Participation (Authoritative Backend Enforcement)

CREATE OR REPLACE FUNCTION public.register_event(p_event_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_user_id UUID := current_user_id();
  v_event events;
  v_reg event_registrations;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Unauthorized' USING ERRCODE = 'U0001'; END IF;

  SELECT * INTO v_event FROM events WHERE id = p_event_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Event not found' USING ERRCODE = 'U0032'; END IF;
  
  -- ENFORCE: Primary Club Admin cannot participate in their own event
  IF EXISTS (
    SELECT 1 FROM event_clubs ec
    JOIN club_memberships cm ON cm.club_id = ec.club_id
    WHERE ec.event_id = p_event_id 
      AND ec.is_primary = true 
      AND cm.user_id = v_user_id 
      AND cm.role = 'CLUB_ADMIN' 
      AND cm.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Primary Club Admin cannot participate in their own event' USING ERRCODE = 'U0004';
  END IF;

  IF v_event.state != 'PUBLISHED' THEN RAISE EXCEPTION 'Event not published' USING ERRCODE = 'U0033'; END IF;
  IF v_event.registration_type = 'TEAM' THEN RAISE EXCEPTION 'Individual registration is not permitted for team events' USING ERRCODE = 'U0027'; END IF;

  -- ENFORCE: Cannot register for permanently or temporarily locked events
  IF v_event.is_locked OR now() >= v_event.end_time + interval '24 hours' THEN 
    RAISE EXCEPTION 'EVENT_LOCKED' USING ERRCODE = 'U0030'; 
  END IF;

  -- ENFORCE: Registration Eligibility
  IF v_event.audience = 'SPECIFIC_BATCHES' THEN
    IF NOT EXISTS (
      SELECT 1 FROM user_academic_profiles uap
      JOIN event_audience_batches eab ON eab.batch_id = uap.batch_id
      WHERE uap.user_id = v_user_id AND eab.event_id = p_event_id
    ) THEN
      RAISE EXCEPTION 'ACADEMICALLY_INELIGIBLE' USING ERRCODE = 'U0031';
    END IF;
  END IF;

  -- Lock-free atomic increment
  UPDATE events 
  SET registration_count = registration_count + 1 
  WHERE id = p_event_id 
    AND state = 'PUBLISHED' 
    AND (max_capacity IS NULL OR registration_count < max_capacity)
  RETURNING * INTO v_event;

  IF FOUND THEN
    INSERT INTO event_registrations (id, event_id, user_id, registration_status, eligibility_scope_snapshot, academic_batch_id_snapshot)
    VALUES (gen_random_uuid(), p_event_id, v_user_id, 'REGISTERED', v_event.audience, CASE WHEN v_event.audience = 'SPECIFIC_BATCHES' THEN (SELECT batch_id FROM user_academic_profiles WHERE user_id = v_user_id) ELSE NULL END)
    RETURNING * INTO v_reg;
    
    RETURN json_build_object('registration_id', v_reg.id, 'status', 'REGISTERED');
  ELSE
    -- Waitlist assignment (capacity full)
    INSERT INTO event_registrations (id, event_id, user_id, registration_status)
    VALUES (gen_random_uuid(), p_event_id, v_user_id, 'WAITLISTED')
    RETURNING * INTO v_reg;
    
    RETURN json_build_object('registration_id', v_reg.id, 'status', 'WAITLISTED');
  END IF;
END;
$function$;

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

  -- ENFORCE: Primary Club Admin cannot participate in their own event
  IF EXISTS (
    SELECT 1 FROM event_clubs ec
    JOIN club_memberships cm ON cm.club_id = ec.club_id
    WHERE ec.event_id = p_event_id 
      AND ec.is_primary = true 
      AND cm.user_id = v_caller_id 
      AND cm.role = 'CLUB_ADMIN' 
      AND cm.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Primary Club Admin cannot participate in their own event' USING ERRCODE = 'U0004';
  END IF;

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

  -- ENFORCE: Primary Club Admin cannot participate in their own event
  IF EXISTS (
    SELECT 1 FROM event_clubs ec
    JOIN club_memberships cm ON cm.club_id = ec.club_id
    WHERE ec.event_id = p_event_id 
      AND ec.is_primary = true 
      AND cm.user_id = v_caller_id 
      AND cm.role = 'CLUB_ADMIN' 
      AND cm.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Primary Club Admin cannot participate in their own event' USING ERRCODE = 'U0004';
  END IF;

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
