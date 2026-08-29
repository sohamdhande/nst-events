-- AlterTable
ALTER TABLE "event_registrations" ADD COLUMN "eligibility_scope_snapshot" "EventAudience";
ALTER TABLE "event_registrations" ADD COLUMN "academic_batch_id_snapshot" UUID;

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
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;

  SELECT * INTO v_event FROM events WHERE id = p_event_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Event not found'; END IF;
  
  IF v_event.state != 'PUBLISHED' THEN RAISE EXCEPTION 'Event not published'; END IF;
  IF v_event.registration_type = 'TEAM' THEN RAISE EXCEPTION 'Individual registration is not permitted for team events'; END IF;

  -- ENFORCE: Cannot register for permanently or temporarily locked events
  IF v_event.is_locked OR now() >= v_event.end_time + interval '24 hours' THEN 
    RAISE EXCEPTION 'EVENT_LOCKED'; 
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
    RAISE EXCEPTION 'Event is locked'; 
  END IF;

  SELECT * INTO v_team FROM teams WHERE id = p_team_id AND event_id = p_event_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Team not found'; END IF;
  IF v_team.status = 'CANCELLED' THEN RAISE EXCEPTION 'Team is cancelled'; END IF;

  -- Ensure user not already registered
  PERFORM 1 FROM event_registrations 
  WHERE event_id = p_event_id AND user_id = v_caller_id AND deleted_at IS NULL;
  IF FOUND THEN RAISE EXCEPTION 'Already in a team'; END IF;

  v_team_size_max := (v_event.metadata->>'maximum_team_size')::INT;
  v_team_size_min := (v_event.metadata->>'minimum_team_size')::INT;

  SELECT count(*) INTO v_team_size FROM event_registrations WHERE team_id = p_team_id AND deleted_at IS NULL;
  IF v_team_size_max IS NOT NULL AND v_team_size >= v_team_size_max THEN
    RAISE EXCEPTION 'Team is full';
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
  IF v_caller_id IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;

  SELECT * INTO v_event FROM events WHERE id = p_event_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Event not found'; END IF;
  IF v_event.state != 'PUBLISHED' THEN RAISE EXCEPTION 'Event not published'; END IF;
  IF v_event.registration_type != 'TEAM' THEN RAISE EXCEPTION 'Event does not support teams'; END IF;
  IF v_event.is_locked = true OR now() >= v_event.end_time + interval '24 hours' THEN 
    RAISE EXCEPTION 'Event is locked'; 
  END IF;

  SELECT * INTO v_team FROM teams WHERE id = p_team_id AND event_id = p_event_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Team not found'; END IF;

  SELECT * INTO v_invitation FROM team_invitations WHERE id = p_invitation_id AND team_id = p_team_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invitation not found'; END IF;
  IF v_invitation.invitee_id != v_caller_id THEN RAISE EXCEPTION 'Invitation not for user'; END IF;
  IF v_invitation.status != 'PENDING' THEN RAISE EXCEPTION 'Invitation invalid'; END IF;
  IF now() >= v_invitation.expires_at THEN RAISE EXCEPTION 'Invitation expired'; END IF;

  -- Ensure user not already registered
  PERFORM 1 FROM event_registrations 
  WHERE event_id = p_event_id AND user_id = v_caller_id AND deleted_at IS NULL;
  IF FOUND THEN RAISE EXCEPTION 'Already in a team'; END IF;

  v_team_size_max := (v_event.metadata->>'maximum_team_size')::INT;
  v_team_size_min := (v_event.metadata->>'minimum_team_size')::INT;

  SELECT count(*) INTO v_team_size FROM event_registrations WHERE team_id = p_team_id AND deleted_at IS NULL;
  IF v_team_size_max IS NOT NULL AND v_team_size >= v_team_size_max THEN
    RAISE EXCEPTION 'Team is full';
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
CREATE OR REPLACE FUNCTION public.process_waitlist(p_event_id uuid)
 RETURNS uuid[]
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_promoted_ids UUID[] := ARRAY[]::UUID[];
  v_team RECORD;
  v_member_ids UUID[];
  v_capacity_left INT;
  v_event events;
BEGIN
  -- Re-read event capacity to ensure we don't violate bounds
  SELECT * INTO v_event FROM events WHERE id = p_event_id FOR UPDATE;

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
  
  RETURN v_promoted_ids;
END;
$function$;
CREATE OR REPLACE FUNCTION public.check_attendance_eligibility(p_event_id uuid, p_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_reg_status TEXT;
  v_eligibility_scope_snapshot TEXT;
  v_academic_batch_id_snapshot UUID;
  v_event_audience TEXT;
  v_user_batch_id UUID;
  v_batch_match BOOLEAN;
BEGIN
  -- ── Registration Check ──────────────────────────────────────────
  SELECT registration_status::text, eligibility_scope_snapshot::text, academic_batch_id_snapshot
  INTO v_reg_status, v_eligibility_scope_snapshot, v_academic_batch_id_snapshot
  FROM event_registrations
  WHERE event_id = p_event_id
    AND user_id = p_user_id
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_REGISTERED' USING ERRCODE = 'U0003';
  END IF;

  IF v_reg_status = 'WAITLISTED' THEN
    RAISE EXCEPTION 'WAITLISTED' USING ERRCODE = 'U0002';
  END IF;

  IF v_reg_status != 'REGISTERED' THEN
    -- Fail closed: CANCELLED or any future unknown status
    RAISE EXCEPTION 'REGISTRATION_NOT_ELIGIBLE' USING ERRCODE = 'U0004';
  END IF;

  -- ── Registration-Time Eligibility Snapshot Check ───────────────────
  IF v_eligibility_scope_snapshot IS NOT NULL THEN
    -- Snapshot exists, meaning eligibility was verified at registration time.
    -- We trust the snapshot entirely. No dynamic recomputation.
    RETURN;
  END IF;

  -- ── Fallback Academic Eligibility Check for Historical Registrations ──────────────────────────────────
  SELECT audience::text INTO v_event_audience
  FROM events
  WHERE id = p_event_id;

  IF v_event_audience = 'ALL_STUDENTS' THEN
    -- No batch restriction applies
    RETURN;
  END IF;

  -- Event audience = SPECIFIC_BATCHES: require matching batch
  SELECT batch_id INTO v_user_batch_id
  FROM user_academic_profiles
  WHERE user_id = p_user_id;

  IF NOT FOUND OR v_user_batch_id IS NULL THEN
    RAISE EXCEPTION 'ACADEMIC_PROFILE_MISSING' USING ERRCODE = 'U0012';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM event_audience_batches
    WHERE event_id = p_event_id
      AND batch_id = v_user_batch_id
  ) INTO v_batch_match;

  IF NOT v_batch_match THEN
    RAISE EXCEPTION 'ACADEMICALLY_INELIGIBLE' USING ERRCODE = 'U0013';
  END IF;

  -- All checks passed
  RETURN;
END;
$function$;
