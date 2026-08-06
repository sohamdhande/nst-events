-- Hotfix to restore mark_attendance implementation overwritten by 20260806120000
CREATE OR REPLACE FUNCTION mark_attendance(
  p_session_id UUID,
  p_totp_token TEXT,
  p_latitude FLOAT,
  p_longitude FLOAT,
  p_device_id TEXT,
  p_device_os TEXT,
  p_gps_accuracy FLOAT,
  p_mock_location_detected BOOLEAN,
  p_app_version TEXT
)
RETURNS attendance_records
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_event_id UUID;
  v_session_open_at TIMESTAMPTZ;
  v_session_close_at TIMESTAMPTZ;
  v_geofence_radius FLOAT;
  v_event_state text;
  v_is_locked BOOLEAN;
  v_location_geofence geography(Point, 4326);
  v_is_registered BOOLEAN;
  v_existing_record attendance_records;
  v_collision_detected BOOLEAN := false;
  v_colliding_user_id UUID;
  v_new_record attendance_records;
  v_audit_metadata JSONB;
BEGIN
  v_user_id := current_user_id();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;

  -- 2. Validate Mock Location
  IF p_mock_location_detected THEN
    RAISE EXCEPTION 'MOCK_LOCATION_REJECTED';
  END IF;

  -- 3. Validate Session and Event
  SELECT 
    s.event_id, s.open_at, s.close_at, s.geofence_radius,
    e.state, e.is_locked, e.location_geofence
  INTO 
    v_event_id, v_session_open_at, v_session_close_at, v_geofence_radius,
    v_event_state, v_is_locked, v_location_geofence
  FROM attendance_sessions s
  JOIN events e ON s.event_id = e.id
  WHERE s.id = p_session_id AND s.deleted_at IS NULL AND e.deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SESSION_CLOSED';
  END IF;

  IF now() < v_session_open_at OR now() > v_session_close_at THEN
    RAISE EXCEPTION 'SESSION_CLOSED';
  END IF;

  IF v_event_state != 'PUBLISHED' OR v_is_locked THEN
    RAISE EXCEPTION 'EVENT_LOCKED';
  END IF;

  -- 4. Geofence Validation
  IF v_location_geofence IS NOT NULL THEN
    IF NOT ST_DWithin(v_location_geofence, ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326), v_geofence_radius) THEN
      RAISE EXCEPTION 'OUTSIDE_GEOFENCE';
    END IF;
  END IF;

  -- 5. Registration Check
  SELECT EXISTS (
    SELECT 1 FROM event_registrations 
    WHERE event_id = v_event_id AND user_id = v_user_id AND deleted_at IS NULL
  ) INTO v_is_registered;

  IF NOT v_is_registered THEN
    RAISE EXCEPTION 'NOT_REGISTERED';
  END IF;

  -- 6. Device Collision Check
  SELECT user_id INTO v_colliding_user_id
  FROM attendance_records
  WHERE session_id = p_session_id 
    AND audit_metadata->>'device_id' = p_device_id
    AND user_id != v_user_id
  LIMIT 1;

  IF FOUND THEN
    v_collision_detected := true;
    
    INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, new_state, ip_address, created_at)
    VALUES (
      v_user_id, 
      'ATTENDANCE_DEVICE_COLLISION', 
      'attendance_session', 
      p_session_id, 
      jsonb_build_object(
        'flagged_user_id', v_user_id,
        'colliding_user_id', v_colliding_user_id,
        'device_id', p_device_id
      ), 
      NULL, 
      now()
    );
  END IF;

  -- 7. Build Audit Metadata
  v_audit_metadata := jsonb_build_object(
    'device_id', p_device_id,
    'device_os', p_device_os,
    'gps_accuracy', p_gps_accuracy,
    'mock_location_detected', p_mock_location_detected,
    'app_version', p_app_version
  );

  IF v_collision_detected THEN
    v_audit_metadata := jsonb_set(v_audit_metadata, '{device_collision_detected}', 'true'::jsonb);
  END IF;

  -- 8. Insert Attendance Record atomically
  INSERT INTO attendance_records (
    session_id, user_id, marked_by, marked_at, method, status, audit_metadata
  ) VALUES (
    p_session_id, v_user_id, NULL, now(), 'QR', 'PRESENT', v_audit_metadata
  ) 
  ON CONFLICT (session_id, user_id) DO NOTHING
  RETURNING * INTO v_new_record;

  IF FOUND THEN
    PERFORM set_config('app.attendance_is_new', 'true', true);
    
    -- 9. Insert Leaderboard Score (Assuming 5 points for attendance as standard)
    INSERT INTO leaderboard_scores (
      user_id, club_id, points, reason, source_id, created_at
    ) VALUES (
      v_user_id, NULL, 5, 'ATTENDANCE', v_new_record.id, now()
    );

    RETURN v_new_record;
  ELSE
    PERFORM set_config('app.attendance_is_new', 'false', true);
    
    SELECT * INTO v_existing_record 
    FROM attendance_records 
    WHERE session_id = p_session_id AND user_id = v_user_id;

    RETURN v_existing_record;
  END IF;
END;
$$;
