-- ATTENDANCE-DISPUTE-02: Security & Contract Hardening
-- Implements proper BOLA for dispute submission.
-- Updates dispute resolution to use SQLSTATE mapping.
-- Fixes resolution semantics (APPROVED -> EXCUSED, 0 points) and audit logging.

CREATE OR REPLACE FUNCTION submit_attendance_dispute(
  p_session_id UUID,
  p_reason TEXT,
  p_evidence_urls TEXT[] DEFAULT NULL
)
RETURNS attendance_disputes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_user_id UUID;
  v_event_id UUID;
  v_event_end_time TIMESTAMPTZ;
  v_dispute_window_expires_at TIMESTAMPTZ;
  v_new_dispute attendance_disputes;
  v_existing_status "AttendanceStatus";
BEGIN
  v_user_id := current_user_id();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING ERRCODE = 'U0001';
  END IF;

  SELECT e.id, e.end_time
  INTO v_event_id, v_event_end_time
  FROM attendance_sessions s
  JOIN events e ON s.event_id = e.id
  WHERE s.id = p_session_id AND s.deleted_at IS NULL AND e.deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SESSION_CLOSED' USING ERRCODE = 'U0049';
  END IF;

  -- ── Check Attendance Eligibility (Registration and Audience Snapshot) ──
  PERFORM check_attendance_eligibility(v_event_id, v_user_id);

  -- ── Prevent disputes if already marked PRESENT or EXCUSED ──
  SELECT status INTO v_existing_status
  FROM attendance_records
  WHERE session_id = p_session_id AND user_id = v_user_id;

  IF FOUND AND v_existing_status IN ('PRESENT', 'EXCUSED') THEN
    RAISE EXCEPTION 'ATTENDANCE_ALREADY_RECORDED' USING ERRCODE = 'U0054';
  END IF;

  v_dispute_window_expires_at := v_event_end_time + INTERVAL '24 hours';

  IF now() > v_dispute_window_expires_at THEN
    RAISE EXCEPTION 'DISPUTE_WINDOW_EXPIRED' USING ERRCODE = 'U0048';
  END IF;

  INSERT INTO attendance_disputes (
    id, session_id, event_id, user_id, reason, evidence_urls, status, dispute_window_expires_at, created_at
  ) VALUES (
    gen_random_uuid(), p_session_id, v_event_id, v_user_id, p_reason, p_evidence_urls, 'PENDING', v_dispute_window_expires_at, now()
  )
  RETURNING * INTO v_new_dispute;

  INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, new_state, created_at)
  VALUES (
    v_user_id, 'DISPUTE_SUBMITTED', 'attendance_disputes', v_new_dispute.id, row_to_json(v_new_dispute)::jsonb, now()
  );

  RETURN v_new_dispute;
END;
$$;

CREATE OR REPLACE FUNCTION resolve_attendance_dispute(
  p_dispute_id UUID,
  p_resolution TEXT,
  p_review_notes TEXT
)
RETURNS attendance_disputes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_dispute attendance_disputes;
  v_actor_id UUID;
  v_previous_state JSONB;
BEGIN
  v_actor_id := current_user_id();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING ERRCODE = 'U0001';
  END IF;

  SELECT * INTO v_dispute FROM attendance_disputes WHERE id = p_dispute_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'DISPUTE_NOT_FOUND' USING ERRCODE = 'U0051';
  END IF;

  v_previous_state := row_to_json(v_dispute)::jsonb;

  IF v_dispute.status != 'PENDING' THEN
    RAISE EXCEPTION 'DISPUTE_ALREADY_RESOLVED' USING ERRCODE = 'U0052';
  END IF;

  IF p_resolution NOT IN ('APPROVED', 'REJECTED') THEN
    RAISE EXCEPTION 'INVALID_RESOLUTION' USING ERRCODE = 'U0053';
  END IF;

  -- BOLA FIX: Normal student cannot resolve their own dispute
  IF v_actor_id = v_dispute.user_id THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING ERRCODE = 'U0001';
  END IF;

  -- BOLA FIX: Verify actor has administrative rights for this event
  IF NOT EXISTS (
    SELECT 1 FROM users u WHERE u.id = v_actor_id AND u.global_role IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN')
  ) AND NOT EXISTS (
    SELECT 1 FROM event_clubs ec
    JOIN club_memberships cm ON ec.club_id = cm.club_id
    WHERE ec.event_id = v_dispute.event_id
      AND cm.user_id = v_actor_id
      AND cm.role IN ('CLUB_ADMIN', 'FACULTY_MENTOR')
      AND cm.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING ERRCODE = 'U0001';
  END IF;

  UPDATE attendance_disputes
  SET status = p_resolution::"DisputeStatus",
      reviewed_by = v_actor_id,
      reviewed_at = now(),
      review_notes = p_review_notes
  WHERE id = p_dispute_id
  RETURNING * INTO v_dispute;

  -- Explicit Audit Log for Dispute Entity
  INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, previous_state, new_state, created_at)
  VALUES (
    v_actor_id, 'RESOLVE_DISPUTE', 'attendance_disputes', v_dispute.id, v_previous_state, row_to_json(v_dispute)::jsonb, now()
  );

  IF p_resolution = 'APPROVED' THEN
    INSERT INTO attendance_records (
      session_id, user_id, marked_by, marked_at, method, status, audit_metadata
    ) VALUES (
      v_dispute.session_id, v_dispute.user_id, v_actor_id, now(), 'SYSTEM', 'EXCUSED', '{"dispute_resolved": true}'::jsonb
    )
    ON CONFLICT (session_id, user_id) DO UPDATE
    SET status = 'EXCUSED',
        marked_by = v_actor_id,
        marked_at = now(),
        audit_metadata = attendance_records.audit_metadata || '{"dispute_resolved": true}'::jsonb;
    -- Note: 0 Points awarded by design.
  END IF;

  RETURN v_dispute;
END;
$$;
