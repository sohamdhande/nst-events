-- Phase 5 Milestone 4 - Manual Attendance and Disputes

-- 1. manual_mark_attendance
CREATE OR REPLACE FUNCTION manual_mark_attendance(
  p_session_id UUID,
  p_user_id UUID
)
RETURNS attendance_records
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id UUID;
  v_is_platform_admin BOOLEAN;
  v_event_id UUID;
  v_event_state text;
  v_is_registered BOOLEAN;
  v_new_record attendance_records;
  v_existing_record attendance_records;
BEGIN
  v_admin_id := current_user_id();
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM users WHERE id = v_admin_id AND global_role = 'PLATFORM_ADMIN'
  ) INTO v_is_platform_admin;

  IF NOT v_is_platform_admin THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;

  SELECT e.id, e.state
  INTO v_event_id, v_event_state
  FROM attendance_sessions s
  JOIN events e ON s.event_id = e.id
  WHERE s.id = p_session_id AND s.deleted_at IS NULL AND e.deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SESSION_CLOSED';
  END IF;

  IF v_event_state != 'PUBLISHED' THEN
    RAISE EXCEPTION 'EVENT_LOCKED';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM event_registrations 
    WHERE event_id = v_event_id AND user_id = p_user_id AND deleted_at IS NULL
  ) INTO v_is_registered;

  IF NOT v_is_registered THEN
    RAISE EXCEPTION 'NOT_REGISTERED';
  END IF;

  INSERT INTO attendance_records (
    session_id, user_id, marked_by, marked_at, method, status, audit_metadata
  ) VALUES (
    p_session_id, p_user_id, v_admin_id, now(), 'MANUAL', 'PRESENT', jsonb_build_object('method', 'MANUAL')
  ) 
  ON CONFLICT (session_id, user_id) DO NOTHING
  RETURNING * INTO v_new_record;

  IF FOUND THEN
    PERFORM set_config('app.attendance_is_new', 'true', true);
    
    INSERT INTO leaderboard_scores (
      user_id, club_id, points, reason, source_id, created_at
    ) VALUES (
      p_user_id, NULL, 5, 'ATTENDANCE', v_new_record.id, now()
    );

    INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, new_state, created_at)
    VALUES (
      v_admin_id, 'ATTENDANCE_MANUAL_MARK', 'attendance_records', v_new_record.id, row_to_json(v_new_record)::jsonb, now()
    );

    RETURN v_new_record;
  ELSE
    PERFORM set_config('app.attendance_is_new', 'false', true);
    
    SELECT * INTO v_existing_record 
    FROM attendance_records 
    WHERE session_id = p_session_id AND user_id = p_user_id;

    RETURN v_existing_record;
  END IF;
END;
$$;

-- 2. submit_attendance_dispute
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
    RAISE EXCEPTION 'SESSION_CLOSED';
  END IF;

  v_dispute_window_expires_at := v_event_end_time + INTERVAL '24 hours';

  IF now() > v_dispute_window_expires_at THEN
    RAISE EXCEPTION 'DISPUTE_WINDOW_EXPIRED';
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

-- 3. resolve_attendance_dispute
CREATE OR REPLACE FUNCTION resolve_attendance_dispute(
  p_dispute_id UUID,
  p_resolution TEXT,
  p_review_notes TEXT
)
RETURNS attendance_disputes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id UUID;
  v_dispute attendance_disputes;
  v_updated_dispute attendance_disputes;
  v_new_record attendance_records;
BEGIN
  v_admin_id := current_user_id();
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;

  IF p_resolution NOT IN ('APPROVED', 'REJECTED') THEN
    RAISE EXCEPTION 'INVALID_RESOLUTION';
  END IF;

  SELECT * INTO v_dispute
  FROM attendance_disputes
  WHERE id = p_dispute_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'DISPUTE_NOT_FOUND';
  END IF;

  IF v_dispute.status != 'PENDING' THEN
    RAISE EXCEPTION 'DISPUTE_ALREADY_RESOLVED';
  END IF;

  UPDATE attendance_disputes
  SET status = p_resolution::attendance_dispute_status_enum,
      review_notes = p_review_notes,
      reviewed_by = v_admin_id,
      reviewed_at = now(),
      updated_at = now()
  WHERE id = p_dispute_id
  RETURNING * INTO v_updated_dispute;

  IF p_resolution = 'APPROVED' THEN
    INSERT INTO attendance_records (
      session_id, user_id, marked_by, marked_at, method, status, audit_metadata
    ) VALUES (
      v_dispute.session_id, v_dispute.user_id, v_admin_id, now(), 'SYSTEM', 'EXCUSED', jsonb_build_object('method', 'SYSTEM', 'dispute_id', p_dispute_id)
    )
    ON CONFLICT (session_id, user_id) DO UPDATE 
    SET status = 'EXCUSED',
        marked_by = v_admin_id,
        marked_at = now(),
        method = 'SYSTEM',
        audit_metadata = EXCLUDED.audit_metadata
    RETURNING * INTO v_new_record;

    INSERT INTO leaderboard_scores (
      user_id, club_id, points, reason, source_id, created_at
    ) VALUES (
      v_dispute.user_id, NULL, 5, 'ATTENDANCE', v_new_record.id, now()
    );

    INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, new_state, created_at)
    VALUES (
      v_admin_id, 'ATTENDANCE_OVERRIDE', 'attendance_records', v_new_record.id, row_to_json(v_new_record)::jsonb, now()
    );
  END IF;

  INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, new_state, created_at)
  VALUES (
    v_admin_id, 'DISPUTE_RESOLVED', 'attendance_disputes', v_updated_dispute.id, row_to_json(v_updated_dispute)::jsonb, now()
  );

  RETURN v_updated_dispute;
END;
$$;
