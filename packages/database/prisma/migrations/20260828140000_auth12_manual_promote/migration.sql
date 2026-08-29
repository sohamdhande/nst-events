CREATE OR REPLACE FUNCTION manual_promote_team(p_team_id UUID)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_catalog'
AS $$
DECLARE
  v_team RECORD;
  v_event RECORD;
  v_member_count INT;
  v_capacity_left INT;
BEGIN
  -- 1. Read team
  SELECT * INTO v_team FROM teams WHERE id = p_team_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Team not found' USING ERRCODE = 'U0034';
  END IF;

  IF v_team.status != 'WAITLISTED' THEN
    RAISE EXCEPTION 'Team is not waitlisted' USING ERRCODE = 'U0050';
  END IF;

  -- 2. Lock event row
  SELECT * INTO v_event FROM events WHERE id = v_team.event_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Event not found' USING ERRCODE = 'U0032';
  END IF;

  IF v_event.is_locked OR now() >= v_event.end_time + interval '24 hours' THEN
    RAISE EXCEPTION 'Event is locked' USING ERRCODE = 'U0030';
  END IF;

  -- 3. Check capacity
  SELECT count(*) INTO v_member_count
  FROM event_registrations 
  WHERE team_id = p_team_id AND deleted_at IS NULL;

  IF v_event.max_capacity IS NOT NULL THEN
    v_capacity_left := v_event.max_capacity - v_event.registration_count;
    IF v_member_count > v_capacity_left THEN
      RAISE EXCEPTION 'Event capacity is full' USING ERRCODE = 'U0022';
    END IF;
  END IF;

  -- 4. Promote team
  UPDATE teams SET status = 'REGISTERED' WHERE id = p_team_id;

  -- 5. Promote registrations & Snapshot
  UPDATE event_registrations
  SET 
    registration_status = 'REGISTERED',
    eligibility_scope_snapshot = v_event.audience,
    academic_batch_id_snapshot = CASE WHEN v_event.audience = 'SPECIFIC_BATCHES' THEN (SELECT batch_id FROM user_academic_profiles WHERE user_id = event_registrations.user_id) ELSE NULL END 
  WHERE team_id = p_team_id AND deleted_at IS NULL;

  -- 6. Update event capacity
  UPDATE events 
  SET registration_count = registration_count + v_member_count 
  WHERE id = v_event.id;

  RETURN json_build_object('success', true, 'promoted_member_count', v_member_count);
END;
$$;
