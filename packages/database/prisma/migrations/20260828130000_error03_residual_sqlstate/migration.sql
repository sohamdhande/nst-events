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
BEGIN
  IF v_caller_id IS NULL THEN RAISE EXCEPTION 'Unauthorized' USING ERRCODE = 'U0001'; END IF;

  SELECT * INTO v_event FROM events WHERE id = p_event_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Event not found' USING ERRCODE = 'U0032'; END IF;
  IF v_event.state != 'PUBLISHED' THEN RAISE EXCEPTION 'Event not published' USING ERRCODE = 'U0033'; END IF;
  IF v_event.registration_type != 'TEAM' THEN RAISE EXCEPTION 'Event does not support teams' USING ERRCODE = 'U0035'; END IF;
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

  -- Ensure user doesn't already have an active team for this event
  PERFORM 1 FROM event_registrations 
  WHERE event_id = p_event_id AND user_id = v_caller_id AND deleted_at IS NULL;
  IF FOUND THEN RAISE EXCEPTION 'Already in a team' USING ERRCODE = 'U0020'; END IF;

  -- Create team in FORMING state (does not consume capacity yet)
  INSERT INTO teams (id, event_id, name, leader_id, status)
  VALUES (gen_random_uuid(), p_event_id, p_name, v_caller_id, 'FORMING')
  RETURNING * INTO v_team;

  INSERT INTO event_registrations (id, event_id, user_id, team_id, registration_status)
  VALUES (gen_random_uuid(), p_event_id, v_caller_id, v_team.id, 'WAITLISTED')
  RETURNING * INTO v_reg;

  RETURN json_build_object('team_id', v_team.id, 'status', 'FORMING', 'registration_id', v_reg.id);
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
  IF v_caller_id IS NULL THEN RAISE EXCEPTION 'Unauthorized' USING ERRCODE = 'U0001'; END IF;

  SELECT * INTO v_event FROM events WHERE id = p_event_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Event not found' USING ERRCODE = 'U0032'; END IF;
  IF v_event.state != 'PUBLISHED' THEN RAISE EXCEPTION 'Event not published' USING ERRCODE = 'U0033'; END IF;
  IF v_event.registration_type != 'TEAM' THEN RAISE EXCEPTION 'Event does not support teams' USING ERRCODE = 'U0035'; END IF;
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

  SELECT * INTO v_team FROM teams WHERE id = p_team_id AND event_id = p_event_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Team not found' USING ERRCODE = 'U0034'; END IF;
  IF v_team.status = 'CANCELLED' THEN RAISE EXCEPTION 'Team is cancelled' USING ERRCODE = 'U0023'; END IF;

  -- Ensure user not already registered
  PERFORM 1 FROM event_registrations 
  WHERE event_id = p_event_id AND user_id = v_caller_id AND deleted_at IS NULL;
  IF FOUND THEN RAISE EXCEPTION 'Already in a team' USING ERRCODE = 'U0020'; END IF;

  v_team_size_max := (v_event.metadata->>'maximum_team_size')::INT;
  v_team_size_min := (v_event.metadata->>'minimum_team_size')::INT;

  SELECT count(*) INTO v_team_size FROM event_registrations WHERE team_id = p_team_id AND deleted_at IS NULL;
  IF v_team_size_max IS NOT NULL AND v_team_size >= v_team_size_max THEN
    RAISE EXCEPTION 'Team is full' USING ERRCODE = 'U0021';
  END IF;

  v_team_size := v_team_size + 1;

  IF v_team.status = 'FORMING' THEN
    IF v_team_size >= v_team_size_min THEN
      -- Try to register
      IF v_event.max_capacity IS NULL OR (v_event.registration_count + v_team_size) <= v_event.max_capacity THEN
        UPDATE teams SET status = 'REGISTERED' WHERE id = p_team_id;
        UPDATE event_registrations SET registration_status = 'REGISTERED', eligibility_scope_snapshot = v_event.audience, academic_batch_id_snapshot = CASE WHEN v_event.audience = 'SPECIFIC_BATCHES' THEN (SELECT batch_id FROM user_academic_profiles WHERE user_id = event_registrations.user_id) ELSE NULL END WHERE team_id = p_team_id AND deleted_at IS NULL;
        UPDATE events SET registration_count = registration_count + v_team_size WHERE id = p_event_id;
        
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
    UPDATE events SET registration_count = registration_count + 1 WHERE id = p_event_id;
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

CREATE OR REPLACE FUNCTION public.accept_invitation(p_event_id uuid, p_team_id uuid, p_invitation_id uuid)
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
  v_invitation team_invitations;
  v_team_size INT;
  v_team_size_max INT;
  v_team_size_min INT;
BEGIN
  IF v_caller_id IS NULL THEN RAISE EXCEPTION 'Unauthorized' USING ERRCODE = 'U0001'; END IF;

  SELECT * INTO v_event FROM events WHERE id = p_event_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Event not found' USING ERRCODE = 'U0032'; END IF;
  IF v_event.state != 'PUBLISHED' THEN RAISE EXCEPTION 'Event not published' USING ERRCODE = 'U0033'; END IF;
  IF v_event.registration_type != 'TEAM' THEN RAISE EXCEPTION 'Event does not support teams' USING ERRCODE = 'U0035'; END IF;
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

  SELECT * INTO v_team FROM teams WHERE id = p_team_id AND event_id = p_event_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Team not found' USING ERRCODE = 'U0034'; END IF;

  SELECT * INTO v_invitation FROM team_invitations WHERE id = p_invitation_id AND team_id = p_team_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invitation not found' USING ERRCODE = 'U0037'; END IF;
  IF v_invitation.invitee_id != v_caller_id THEN RAISE EXCEPTION 'Invitation not for user' USING ERRCODE = 'U0026'; END IF;
  IF v_invitation.status != 'PENDING' THEN RAISE EXCEPTION 'Invitation invalid' USING ERRCODE = 'U0025'; END IF;
  IF now() >= v_invitation.expires_at THEN RAISE EXCEPTION 'Invitation expired' USING ERRCODE = 'U0024'; END IF;

  -- Ensure user not already registered
  PERFORM 1 FROM event_registrations 
  WHERE event_id = p_event_id AND user_id = v_caller_id AND deleted_at IS NULL;
  IF FOUND THEN RAISE EXCEPTION 'Already in a team' USING ERRCODE = 'U0020'; END IF;

  v_team_size_max := (v_event.metadata->>'maximum_team_size')::INT;
  v_team_size_min := (v_event.metadata->>'minimum_team_size')::INT;

  SELECT count(*) INTO v_team_size FROM event_registrations WHERE team_id = p_team_id AND deleted_at IS NULL;
  IF v_team_size_max IS NOT NULL AND v_team_size >= v_team_size_max THEN
    RAISE EXCEPTION 'Team is full' USING ERRCODE = 'U0021';
  END IF;

  UPDATE team_invitations SET status = 'ACCEPTED', responded_at = now() WHERE id = p_invitation_id;

  v_team_size := v_team_size + 1;

  -- Evaluate transitions
  IF v_team.status = 'FORMING' THEN
    IF v_team_size >= v_team_size_min THEN
      -- Try to register
      IF v_event.max_capacity IS NULL OR (v_event.registration_count + v_team_size) <= v_event.max_capacity THEN
        UPDATE teams SET status = 'REGISTERED' WHERE id = p_team_id;
        UPDATE event_registrations SET registration_status = 'REGISTERED', eligibility_scope_snapshot = v_event.audience, academic_batch_id_snapshot = CASE WHEN v_event.audience = 'SPECIFIC_BATCHES' THEN (SELECT batch_id FROM user_academic_profiles WHERE user_id = event_registrations.user_id) ELSE NULL END WHERE team_id = p_team_id AND deleted_at IS NULL;
        UPDATE events SET registration_count = registration_count + v_team_size WHERE id = p_event_id;
        
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
    UPDATE events SET registration_count = registration_count + 1 WHERE id = p_event_id;
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
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = 'U0001';
  END IF;

  SELECT * INTO v_event FROM events WHERE id = p_event_id FOR UPDATE;
  IF v_event.is_locked = true OR now() >= v_event.end_time + interval '24 hours' THEN 
    RAISE EXCEPTION 'Event is locked' USING ERRCODE = 'U0030'; 
  END IF;

  SELECT * INTO v_team FROM teams WHERE id = p_team_id AND event_id = p_event_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Team not found' USING ERRCODE = 'U0034'; END IF;

  IF v_team.leader_id = p_user_id THEN
    RAISE EXCEPTION 'Leader cannot leave. Transfer leadership or cancel team.' USING ERRCODE = 'U0040';
  END IF;

  UPDATE event_registrations SET deleted_at = now() 
  WHERE team_id = p_team_id AND user_id = p_user_id AND deleted_at IS NULL;

  IF NOT FOUND THEN RAISE EXCEPTION 'Member not found in team' USING ERRCODE = 'U0039'; END IF;

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
  IF v_caller_id IS NULL THEN RAISE EXCEPTION 'Unauthorized' USING ERRCODE = 'U0001'; END IF;
  -- Express middleware handles caller role validation (Leader or Admin)

  SELECT * INTO v_event FROM events WHERE id = p_event_id;
  IF v_event.is_locked = true OR now() >= v_event.end_time + interval '24 hours' THEN 
    RAISE EXCEPTION 'Event is locked' USING ERRCODE = 'U0030'; 
  END IF;

  SELECT * INTO v_team FROM teams WHERE id = p_team_id AND event_id = p_event_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Team not found' USING ERRCODE = 'U0034'; END IF;

  -- Verify new leader is a member
  PERFORM 1 FROM event_registrations 
  WHERE team_id = p_team_id AND user_id = p_new_leader_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'New leader must be an active member' USING ERRCODE = 'U0041'; END IF;

  UPDATE teams SET leader_id = p_new_leader_id WHERE id = p_team_id RETURNING * INTO v_team;

  RETURN row_to_json(v_team);
END;
$$;

CREATE OR REPLACE FUNCTION submit_event_for_approval(p_event_id UUID)
RETURNS events
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event events;
  v_caller_id UUID := current_user_id();
BEGIN
  SELECT * INTO v_event FROM events WHERE id = p_event_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Event not found' USING ERRCODE = 'U0032';
  END IF;

  IF v_event.state != 'DRAFT' THEN
    RAISE EXCEPTION 'Event must be in DRAFT state' USING ERRCODE = 'U0043';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM event_clubs ec
    WHERE ec.event_id = p_event_id
    AND ec.is_primary = true
    AND has_club_role(ec.club_id, v_caller_id, ARRAY['CLUB_ADMIN', 'CORE_MEMBER'])
  ) AND NOT EXISTS (
    SELECT 1 FROM users u WHERE u.id = v_caller_id AND u.global_role IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN')
  ) THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = 'U0001';
  END IF;

  UPDATE events SET state = 'PENDING_APPROVAL' WHERE id = p_event_id AND state = 'DRAFT' RETURNING * INTO v_event;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Race condition: Event state changed during transaction' USING ERRCODE = 'U0045';
  END IF;

  INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, previous_state, new_state, created_at)
  VALUES (v_caller_id, 'EVENT_SUBMITTED', 'event', p_event_id, jsonb_build_object('state', 'DRAFT'), jsonb_build_object('state', 'PENDING_APPROVAL'), now());

  RETURN v_event;
END;
$$;

CREATE OR REPLACE FUNCTION approve_event(p_event_id UUID)
RETURNS events
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event events;
  v_caller_id UUID := current_user_id();
  v_is_global_admin BOOLEAN;
  v_is_mentor BOOLEAN;
BEGIN
  SELECT * INTO v_event FROM events WHERE id = p_event_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Event not found' USING ERRCODE = 'U0032';
  END IF;

  IF v_event.state != 'PENDING_APPROVAL' THEN
    RAISE EXCEPTION 'Event must be in PENDING_APPROVAL state' USING ERRCODE = 'U0044';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM users u WHERE u.id = v_caller_id AND u.global_role IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN')
  ) INTO v_is_global_admin;

  SELECT EXISTS (
    SELECT 1 FROM event_clubs ec
    WHERE ec.event_id = p_event_id
    AND ec.is_primary = true
    AND has_club_role(ec.club_id, v_caller_id, ARRAY['FACULTY_MENTOR'])
  ) INTO v_is_mentor;

  IF NOT v_is_global_admin AND NOT v_is_mentor THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = 'U0001';
  END IF;

  UPDATE events SET state = 'PUBLISHED' WHERE id = p_event_id AND state = 'PENDING_APPROVAL' RETURNING * INTO v_event;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Race condition: Event state changed during transaction' USING ERRCODE = 'U0045';
  END IF;

  INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, previous_state, new_state, created_at)
  VALUES (v_caller_id, 'EVENT_APPROVED', 'event', p_event_id, jsonb_build_object('state', 'PENDING_APPROVAL'), jsonb_build_object('state', 'PUBLISHED'), now());

  RETURN v_event;
END;
$$;

CREATE OR REPLACE FUNCTION reject_event(p_event_id UUID, p_reason TEXT)
RETURNS events
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event events;
  v_caller_id UUID := current_user_id();
  v_is_global_admin BOOLEAN;
  v_is_mentor BOOLEAN;
BEGIN
  SELECT * INTO v_event FROM events WHERE id = p_event_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Event not found' USING ERRCODE = 'U0032';
  END IF;

  IF v_event.state != 'PENDING_APPROVAL' THEN
    RAISE EXCEPTION 'Event must be in PENDING_APPROVAL state' USING ERRCODE = 'U0044';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM users u WHERE u.id = v_caller_id AND u.global_role IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN')
  ) INTO v_is_global_admin;

  SELECT EXISTS (
    SELECT 1 FROM event_clubs ec
    WHERE ec.event_id = p_event_id
    AND ec.is_primary = true
    AND has_club_role(ec.club_id, v_caller_id, ARRAY['FACULTY_MENTOR'])
  ) INTO v_is_mentor;

  IF NOT v_is_global_admin AND NOT v_is_mentor THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = 'U0001';
  END IF;

  UPDATE events SET state = 'DRAFT' WHERE id = p_event_id AND state = 'PENDING_APPROVAL' RETURNING * INTO v_event;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Race condition: Event state changed during transaction' USING ERRCODE = 'U0045';
  END IF;

  INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, previous_state, new_state, created_at)
  VALUES (v_caller_id, 'EVENT_REJECTED', 'event', p_event_id, jsonb_build_object('state', 'PENDING_APPROVAL'), jsonb_build_object('state', 'DRAFT', 'rejection_reason', p_reason), now());

  RETURN v_event;
END;
$$;

CREATE OR REPLACE FUNCTION submit_attendance_dispute(
  p_session_id UUID,
  p_reason TEXT,
  p_evidence_urls TEXT[] DEFAULT NULL
)
RETURNS attendance_disputes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_event_id UUID;
  v_event_end_time TIMESTAMPTZ;
  v_dispute_window_expires_at TIMESTAMPTZ;
  v_new_dispute attendance_disputes;
BEGIN
  v_user_id := current_user_id();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;

  SELECT e.id, e.end_time
  INTO v_event_id, v_event_end_time
  FROM attendance_sessions s
  JOIN events e ON s.event_id = e.id
  WHERE s.id = p_session_id AND s.deleted_at IS NULL AND e.deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SESSION_CLOSED' USING ERRCODE = 'U0049';
  END IF;

  v_dispute_window_expires_at := v_event_end_time + INTERVAL '24 hours';

  IF now() > v_dispute_window_expires_at THEN
    RAISE EXCEPTION 'DISPUTE_WINDOW_EXPIRED' USING ERRCODE = 'U0048';
  END IF;

  INSERT INTO attendance_disputes (
    session_id, event_id, user_id, reason, evidence_urls, status, dispute_window_expires_at, created_at, updated_at
  ) VALUES (
    p_session_id, v_event_id, v_user_id, p_reason, p_evidence_urls, 'PENDING', v_dispute_window_expires_at, now(), now()
  )
  RETURNING * INTO v_new_dispute;

  INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, new_state, created_at)
  VALUES (
    v_user_id, 'DISPUTE_SUBMITTED', 'attendance_disputes', v_new_dispute.id, row_to_json(v_new_dispute)::jsonb, now()
  );

  RETURN v_new_dispute;
END;
$$;

