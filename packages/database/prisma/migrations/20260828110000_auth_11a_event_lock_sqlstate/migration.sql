-- Modify cancel_team
CREATE OR REPLACE FUNCTION cancel_team(p_event_id UUID, p_team_id UUID)
RETURNS UUID[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID := current_user_id();
  v_reg event_registrations;
  v_team teams;
  v_event events;
  v_member_count INT;
  v_promoted UUID[] := ARRAY[]::UUID[];
BEGIN
  -- Express middleware handles caller authorization (Leader as last member or Admin)
  SELECT * INTO v_event FROM events WHERE id = p_event_id FOR UPDATE;
  IF v_event.is_locked = true OR now() >= v_event.end_time + interval '24 hours' THEN 
    RAISE EXCEPTION 'Event is locked' USING ERRCODE = 'U0030'; 
  END IF;

  SELECT * INTO v_team FROM teams WHERE id = p_team_id AND event_id = p_event_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Team not found'; END IF;

  -- Ensure caller is authorized (Leader or Admin)
  IF v_caller_id != v_team.leader_id AND NOT EXISTS (
    SELECT 1 FROM users WHERE id = v_caller_id AND global_role IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN')
  ) THEN
    -- Or club admin, handled by Express middleware before entering RPC
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE teams SET status = 'CANCELLED', deleted_at = now() WHERE id = p_team_id;
  UPDATE event_registrations SET deleted_at = now() WHERE team_id = p_team_id AND deleted_at IS NULL;
  
  IF v_team.status = 'REGISTERED' THEN
    SELECT count(*) INTO v_member_count FROM event_registrations WHERE team_id = p_team_id AND deleted_at = now();
    UPDATE events SET registration_count = registration_count - v_member_count WHERE id = p_event_id;
    -- Note: We do NOT automatically promote from the waitlist here because
    -- waitlist promotion for teams is non-deterministic (depends on team sizes).
    -- Waitlist promotion is triggered explicitly via process_waitlist(event_id).
  END IF;

  RETURN v_promoted;
END;
$$;


-- Modify leave_team
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
  v_event events;
  v_member_count INT;
  v_promoted UUID[] := ARRAY[]::UUID[];
BEGIN
  IF v_caller_id != p_user_id AND NOT EXISTS (
    SELECT 1 FROM users WHERE id = v_caller_id AND global_role IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN')
  ) THEN
    -- Or club admin, handled by Express middleware before entering RPC
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT * INTO v_event FROM events WHERE id = p_event_id FOR UPDATE;
  IF v_event.is_locked = true OR now() >= v_event.end_time + interval '24 hours' THEN 
    RAISE EXCEPTION 'Event is locked' USING ERRCODE = 'U0030'; 
  END IF;

  SELECT * INTO v_team FROM teams WHERE id = p_team_id AND event_id = p_event_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Team not found'; END IF;

  IF v_team.leader_id = p_user_id THEN
    RAISE EXCEPTION 'Leader cannot leave. Transfer leadership or cancel team.';
  END IF;

  UPDATE event_registrations SET deleted_at = now() 
  WHERE team_id = p_team_id AND user_id = p_user_id AND deleted_at IS NULL;

  IF NOT FOUND THEN RAISE EXCEPTION 'Member not found in team'; END IF;

  IF v_team.status = 'REGISTERED' THEN
    UPDATE events SET registration_count = registration_count - 1 WHERE id = p_event_id;
  END IF;

  -- Re-evaluate team status
  SELECT count(*) INTO v_member_count FROM event_registrations WHERE team_id = p_team_id AND deleted_at IS NULL;
  
  IF v_team.status = 'REGISTERED' AND v_member_count < COALESCE((v_event.metadata->>'minimum_team_size')::INT, 1) THEN
    -- Team fell below minimum size, demote to WAITLISTED
    UPDATE teams SET status = 'WAITLISTED' WHERE id = p_team_id;
    UPDATE event_registrations SET registration_status = 'WAITLISTED', eligibility_scope_snapshot = NULL, academic_batch_id_snapshot = NULL WHERE team_id = p_team_id AND deleted_at IS NULL;
    UPDATE events SET registration_count = registration_count - v_member_count WHERE id = p_event_id;
  END IF;

  RETURN v_promoted;
END;
$$;


-- Modify transfer_leadership
CREATE OR REPLACE FUNCTION transfer_leadership(p_event_id UUID, p_team_id UUID, p_new_leader_id UUID)
RETURNS json
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
  -- Express middleware handles caller role validation (Leader or Admin)

  SELECT * INTO v_event FROM events WHERE id = p_event_id;
  IF v_event.is_locked = true OR now() >= v_event.end_time + interval '24 hours' THEN 
    RAISE EXCEPTION 'Event is locked' USING ERRCODE = 'U0030'; 
  END IF;

  SELECT * INTO v_team FROM teams WHERE id = p_team_id AND event_id = p_event_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Team not found'; END IF;

  -- Verify new leader is a member
  PERFORM 1 FROM event_registrations 
  WHERE team_id = p_team_id AND user_id = p_new_leader_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'New leader must be an active member'; END IF;

  UPDATE teams SET leader_id = p_new_leader_id WHERE id = p_team_id RETURNING * INTO v_team;

  RETURN row_to_json(v_team);
END;
$$;
