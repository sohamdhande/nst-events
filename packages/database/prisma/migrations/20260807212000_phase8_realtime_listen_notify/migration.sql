-- 1. Create Helper Function
CREATE OR REPLACE FUNCTION emit_event_live_update(p_event_id UUID, p_type TEXT, p_payload JSONB)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM pg_notify(
    'event_' || p_event_id || '_live',
    json_build_object('type', p_type, 'payload', p_payload)::text
  );
END;
$$;

-- 2. Modify process_waitlist
CREATE OR REPLACE FUNCTION process_waitlist(p_event_id UUID)
RETURNS UUID[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_promoted_ids UUID[] := ARRAY[]::UUID[];
  v_candidate RECORD;
BEGIN
  SELECT er.* INTO v_candidate
  FROM event_registrations er
  LEFT JOIN teams t ON er.team_id = t.id
  WHERE er.event_id = p_event_id 
    AND er.registration_status = 'WAITLISTED' 
    AND er.deleted_at IS NULL
    AND (er.team_id IS NULL OR t.deleted_at IS NULL)
  ORDER BY er.registered_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;
  
  IF FOUND THEN
    UPDATE event_registrations 
    SET registration_status = 'REGISTERED' 
    WHERE id = v_candidate.id;
    
    v_promoted_ids := array_append(v_promoted_ids, v_candidate.user_id);
    
    PERFORM emit_event_live_update(
      p_event_id, 
      'waitlist_update', 
      jsonb_build_object('user_id', v_candidate.user_id, 'status', 'REGISTERED')
    );
  END IF;
  
  RETURN v_promoted_ids;
END;
$$;

-- 3. Modify register_event
CREATE OR REPLACE FUNCTION register_event(p_event_id UUID)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := current_user_id();
  v_event events;
  v_reg event_registrations;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;

  UPDATE events 
  SET registration_count = registration_count + 1 
  WHERE id = p_event_id 
    AND state = 'PUBLISHED' 
    AND (max_capacity IS NULL OR registration_count < max_capacity)
  RETURNING * INTO v_event;

  IF FOUND THEN
    INSERT INTO event_registrations (event_id, user_id, registration_status)
    VALUES (p_event_id, v_user_id, 'REGISTERED')
    RETURNING * INTO v_reg;
    
    PERFORM emit_event_live_update(p_event_id, 'registration_count', jsonb_build_object('count', v_event.registration_count));
    
    RETURN json_build_object('registration_id', v_reg.id, 'status', 'REGISTERED');
  ELSE
    SELECT * INTO v_event FROM events WHERE id = p_event_id AND state = 'PUBLISHED';
    IF NOT FOUND THEN RAISE EXCEPTION 'Event not found or not published'; END IF;

    INSERT INTO event_registrations (event_id, user_id, registration_status)
    VALUES (p_event_id, v_user_id, 'WAITLISTED')
    RETURNING * INTO v_reg;
    
    RETURN json_build_object('registration_id', v_reg.id, 'status', 'WAITLISTED');
  END IF;
END;
$$;

-- 4. Modify cancel_registration
CREATE OR REPLACE FUNCTION cancel_registration(p_event_id UUID, p_user_id UUID)
RETURNS UUID[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

  UPDATE event_registrations 
  SET deleted_at = now(), registration_status = 'CANCELLED' 
  WHERE event_id = p_event_id AND user_id = p_user_id AND deleted_at IS NULL
  RETURNING * INTO v_reg;

  IF NOT FOUND THEN RAISE EXCEPTION 'Registration not found'; END IF;

  IF v_reg.registration_status = 'REGISTERED' THEN
    v_promoted := process_waitlist(p_event_id);
    IF array_length(v_promoted, 1) IS NULL THEN
      UPDATE events SET registration_count = registration_count - 1 WHERE id = p_event_id RETURNING registration_count INTO v_new_count;
    ELSE
      SELECT registration_count INTO v_new_count FROM events WHERE id = p_event_id;
    END IF;
    
    PERFORM emit_event_live_update(p_event_id, 'registration_count', jsonb_build_object('count', v_new_count));
  END IF;

  RETURN v_promoted;
END;
$$;

-- 5. Modify create_team
CREATE OR REPLACE FUNCTION create_team(p_event_id UUID, p_team_name TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID := current_user_id();
  v_team teams;
  v_event events;
BEGIN
  IF v_caller_id IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;

  SELECT * INTO v_event FROM events WHERE id = p_event_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Event not found'; END IF;
  IF v_event.state != 'PUBLISHED' THEN RAISE EXCEPTION 'Event not published'; END IF;
  IF v_event.registration_type != 'TEAM' THEN RAISE EXCEPTION 'Event does not support teams'; END IF;

  IF v_event.max_capacity IS NOT NULL AND v_event.registration_count >= v_event.max_capacity THEN
    RAISE EXCEPTION 'Event capacity is full. Cannot create team.';
  END IF;

  INSERT INTO teams (event_id, name, leader_id)
  VALUES (p_event_id, p_team_name, v_caller_id)
  RETURNING * INTO v_team;

  UPDATE events 
  SET registration_count = registration_count + 1 
  WHERE id = p_event_id RETURNING * INTO v_event;
  
  INSERT INTO event_registrations (event_id, user_id, team_id, registration_status)
  VALUES (p_event_id, v_caller_id, v_team.id, 'REGISTERED');

  PERFORM emit_event_live_update(p_event_id, 'registration_count', jsonb_build_object('count', v_event.registration_count));

  RETURN v_team.id;
END;
$$;

-- 6. Modify join_team
CREATE OR REPLACE FUNCTION join_team(p_event_id UUID, p_team_id UUID)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID := current_user_id();
  v_reg event_registrations;
  v_event events;
  v_team_size INT;
  v_team_size_max INT;
BEGIN
  IF v_caller_id IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;

  SELECT * INTO v_event FROM events WHERE id = p_event_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Event not found'; END IF;
  IF v_event.state != 'PUBLISHED' THEN RAISE EXCEPTION 'Event not published'; END IF;
  IF v_event.registration_type != 'TEAM' THEN RAISE EXCEPTION 'Event does not support teams'; END IF;

  PERFORM 1 FROM teams WHERE id = p_team_id AND event_id = p_event_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Team not found'; END IF;

  v_team_size_max := (v_event.metadata->>'team_size_max')::INT;
  IF v_team_size_max IS NOT NULL THEN
    SELECT count(*) INTO v_team_size FROM event_registrations WHERE team_id = p_team_id AND deleted_at IS NULL;
    IF v_team_size >= v_team_size_max THEN
      RAISE EXCEPTION 'Team is full';
    END IF;
  END IF;

  UPDATE events 
  SET registration_count = registration_count + 1 
  WHERE id = p_event_id AND (max_capacity IS NULL OR registration_count < max_capacity)
  RETURNING * INTO v_event;
  
  IF FOUND THEN
    INSERT INTO event_registrations (event_id, user_id, team_id, registration_status)
    VALUES (p_event_id, v_caller_id, p_team_id, 'REGISTERED')
    RETURNING * INTO v_reg;
    
    PERFORM emit_event_live_update(p_event_id, 'registration_count', jsonb_build_object('count', v_event.registration_count));
    
    RETURN json_build_object('registration_id', v_reg.id, 'status', 'REGISTERED');
  ELSE
    INSERT INTO event_registrations (event_id, user_id, team_id, registration_status)
    VALUES (p_event_id, v_caller_id, p_team_id, 'WAITLISTED')
    RETURNING * INTO v_reg;
    
    RETURN json_build_object('registration_id', v_reg.id, 'status', 'WAITLISTED');
  END IF;
END;
$$;

-- 7. Modify leave_team
CREATE OR REPLACE FUNCTION leave_team(p_event_id UUID, p_team_id UUID, p_user_id UUID)
RETURNS UUID[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID := current_user_id();
  v_reg event_registrations;
  v_team teams;
  v_promoted UUID[] := ARRAY[]::UUID[];
  v_new_leader UUID;
  v_new_count INT;
BEGIN
  IF v_caller_id != p_user_id AND NOT EXISTS (
    SELECT 1 FROM users WHERE id = v_caller_id AND global_role IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN')
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  PERFORM 1 FROM events WHERE id = p_event_id FOR UPDATE;
  SELECT * INTO v_team FROM teams WHERE id = p_team_id AND event_id = p_event_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Team not found'; END IF;

  UPDATE event_registrations 
  SET deleted_at = now(), registration_status = 'CANCELLED' 
  WHERE event_id = p_event_id AND team_id = p_team_id AND user_id = p_user_id AND deleted_at IS NULL
  RETURNING * INTO v_reg;
  
  IF NOT FOUND THEN RAISE EXCEPTION 'Registration not found'; END IF;

  IF v_team.leader_id = p_user_id THEN
    SELECT user_id INTO v_new_leader
    FROM event_registrations
    WHERE team_id = p_team_id AND deleted_at IS NULL AND registration_status = 'REGISTERED'
    ORDER BY registered_at ASC LIMIT 1;
    
    IF v_new_leader IS NOT NULL THEN
      UPDATE teams SET leader_id = v_new_leader WHERE id = p_team_id;
    ELSE
      UPDATE teams SET deleted_at = now() WHERE id = p_team_id;
      UPDATE event_registrations 
      SET deleted_at = now(), registration_status = 'CANCELLED'
      WHERE team_id = p_team_id AND deleted_at IS NULL AND registration_status = 'WAITLISTED';
    END IF;
  END IF;

  IF v_reg.registration_status = 'REGISTERED' THEN
    v_promoted := process_waitlist(p_event_id);
    IF array_length(v_promoted, 1) IS NULL THEN
      UPDATE events SET registration_count = registration_count - 1 WHERE id = p_event_id RETURNING registration_count INTO v_new_count;
    ELSE
      SELECT registration_count INTO v_new_count FROM events WHERE id = p_event_id;
    END IF;
    
    PERFORM emit_event_live_update(p_event_id, 'registration_count', jsonb_build_object('count', v_new_count));
  END IF;

  RETURN v_promoted;
END;
$$;
