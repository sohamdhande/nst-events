-- Fix RPCs to include id = gen_random_uuid() for event_registrations and teams inserts

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
    INSERT INTO event_registrations (id, event_id, user_id, registration_status)
    VALUES (gen_random_uuid(), p_event_id, v_user_id, 'REGISTERED')
    RETURNING * INTO v_reg;
    
    RETURN json_build_object('registration_id', v_reg.id, 'status', 'REGISTERED');
  ELSE
    SELECT * INTO v_event FROM events WHERE id = p_event_id AND state = 'PUBLISHED';
    IF NOT FOUND THEN RAISE EXCEPTION 'Event not found or not published'; END IF;

    INSERT INTO event_registrations (id, event_id, user_id, registration_status)
    VALUES (gen_random_uuid(), p_event_id, v_user_id, 'WAITLISTED')
    RETURNING * INTO v_reg;
    
    RETURN json_build_object('registration_id', v_reg.id, 'status', 'WAITLISTED');
  END IF;
END;
$$;

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

  INSERT INTO teams (id, event_id, name, leader_id)
  VALUES (gen_random_uuid(), p_event_id, p_team_name, v_caller_id)
  RETURNING * INTO v_team;

  UPDATE events 
  SET registration_count = registration_count + 1 
  WHERE id = p_event_id;
  
  INSERT INTO event_registrations (id, event_id, user_id, team_id, registration_status)
  VALUES (gen_random_uuid(), p_event_id, v_caller_id, v_team.id, 'REGISTERED');

  RETURN v_team.id;
END;
$$;

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
  WHERE id = p_event_id AND (max_capacity IS NULL OR registration_count < max_capacity);
  
  IF FOUND THEN
    INSERT INTO event_registrations (id, event_id, user_id, team_id, registration_status)
    VALUES (gen_random_uuid(), p_event_id, v_caller_id, p_team_id, 'REGISTERED')
    RETURNING * INTO v_reg;
    RETURN json_build_object('registration_id', v_reg.id, 'status', 'REGISTERED');
  ELSE
    INSERT INTO event_registrations (id, event_id, user_id, team_id, registration_status)
    VALUES (gen_random_uuid(), p_event_id, v_caller_id, p_team_id, 'WAITLISTED')
    RETURNING * INTO v_reg;
    RETURN json_build_object('registration_id', v_reg.id, 'status', 'WAITLISTED');
  END IF;
END;
$$;
