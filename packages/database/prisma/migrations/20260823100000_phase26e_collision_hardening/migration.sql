-- 1. Modify mark_attendance
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
  PERFORM pg_advisory_xact_lock(hashtext(p_session_id::text), hashtext(p_device_id));

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
    
    -- 9. Insert Leaderboard Score (only if NOT flagged)
    IF NOT v_collision_detected THEN
      INSERT INTO leaderboard_scores (
        id, user_id, club_id, points, reason, source_id, created_at
      ) VALUES (
        gen_random_uuid(), v_user_id, NULL, 5, 'ATTENDANCE', v_new_record.id, now()
      );
    END IF;

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

-- 2. Modify sync_offline_attendance
DROP FUNCTION IF EXISTS sync_offline_attendance(jsonb);
CREATE OR REPLACE FUNCTION sync_offline_attendance(
  p_payloads JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id UUID;
  v_event_id UUID;
  v_session_id UUID;
  v_is_locked BOOLEAN;
  v_location_geofence geography(Point, 4326);
  v_geofence_radius FLOAT;
  v_payload JSONB;
  v_user_id UUID;
  v_scan_timestamp TIMESTAMPTZ;
  v_device_id TEXT;
  v_lat FLOAT;
  v_lng FLOAT;
  v_is_registered BOOLEAN;
  v_collision_detected BOOLEAN;
  v_colliding_user_id UUID;
  v_audit_metadata JSONB;
  v_new_record attendance_records;
  v_processed INT := 0;
  v_skipped INT := 0;
  v_errors JSONB := '[]'::jsonb;
  v_signature TEXT;
BEGIN
  v_actor_id := current_user_id();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;



  -- 2. Loop through each payload and process
  FOR v_payload IN SELECT * FROM jsonb_array_elements(p_payloads) ORDER BY value->>'device_id'
  LOOP
    BEGIN
      v_session_id := (v_payload->>'session_id')::UUID;

      -- 1. Validate Session and get event details (done per payload because p_session_id is removed)
      SELECT s.event_id, e.is_locked, s.geofence_radius, e.location_geofence
      INTO v_event_id, v_is_locked, v_geofence_radius, v_location_geofence
      FROM attendance_sessions s
      JOIN events e ON s.event_id = e.id
      WHERE s.id = v_session_id AND s.deleted_at IS NULL AND e.deleted_at IS NULL;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'SESSION_CLOSED';
      END IF;

      IF v_is_locked THEN
        RAISE EXCEPTION 'EVENT_LOCKED';
      END IF;

      v_user_id := (v_payload->>'user_id')::UUID;
      v_scan_timestamp := (v_payload->>'scan_timestamp')::TIMESTAMPTZ;
      v_device_id := v_payload->>'device_id';
      v_lat := (v_payload->>'gps_lat')::FLOAT;
      v_lng := (v_payload->>'gps_lng')::FLOAT;
      v_signature := v_payload->>'scanned_token'; -- In Phase 26B, scanned_token serves as the unique signature for replay protection

      -- Replay Protection
      BEGIN
        INSERT INTO consumed_qr_signatures (session_id, signature)
        VALUES (v_session_id, v_signature);
      EXCEPTION WHEN unique_violation THEN
        RAISE EXCEPTION 'SIGNATURE_ALREADY_CONSUMED';
      END;

      -- Geofence Validation
      IF v_location_geofence IS NOT NULL THEN
        IF NOT ST_DWithin(v_location_geofence, ST_SetSRID(ST_MakePoint(v_lng, v_lat), 4326), v_geofence_radius) THEN
          RAISE EXCEPTION 'OUTSIDE_GEOFENCE';
        END IF;
      END IF;

      -- Registration Check
      SELECT EXISTS (
        SELECT 1 FROM event_registrations 
        WHERE event_id = v_event_id AND user_id = v_user_id AND deleted_at IS NULL
      ) INTO v_is_registered;

      IF NOT v_is_registered THEN
        RAISE EXCEPTION 'NOT_REGISTERED';
      END IF;

      -- Device Collision Check
      PERFORM pg_advisory_xact_lock(hashtext(v_session_id::text), hashtext(v_device_id));

      v_collision_detected := false;
      SELECT user_id INTO v_colliding_user_id
      FROM attendance_records
      WHERE session_id = v_session_id 
        AND audit_metadata->>'device_id' = v_device_id
        AND user_id != v_user_id
      LIMIT 1;

      IF FOUND THEN
        v_collision_detected := true;
        INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, new_state, ip_address, created_at)
        VALUES (
          v_user_id, 
          'ATTENDANCE_DEVICE_COLLISION', 
          'attendance_session', 
          v_session_id, 
          jsonb_build_object(
            'flagged_user_id', v_user_id,
            'colliding_user_id', v_colliding_user_id,
            'device_id', v_device_id,
            'offline_sync', true
          ), 
          NULL, 
          now()
        );
      END IF;

      -- Build Audit Metadata
      v_audit_metadata := jsonb_build_object(
        'device_id', v_device_id,
        'offline_sync', true,
        'offline_seq', (v_payload->>'offline_seq')::INT
      );

      IF v_collision_detected THEN
        v_audit_metadata := jsonb_set(v_audit_metadata, '{device_collision_detected}', 'true'::jsonb);
      END IF;

      -- Insert Attendance Record
      INSERT INTO public.attendance_records (
        session_id, user_id, marked_by, marked_at, method, status, audit_metadata
      ) VALUES (
        v_session_id, v_user_id, v_actor_id, v_scan_timestamp, 'QR', 'PRESENT', v_audit_metadata
      )
      ON CONFLICT (session_id, user_id) DO NOTHING
      RETURNING * INTO v_new_record;

      IF FOUND THEN
        IF NOT v_collision_detected THEN
          INSERT INTO public.leaderboard_scores (
            id, user_id, club_id, points, reason, source_id, created_at
          ) VALUES (
            gen_random_uuid(), v_user_id, NULL, 5, 'ATTENDANCE', v_new_record.id, now()
          );
        END IF;
        v_processed := v_processed + 1;
      ELSE
        v_skipped := v_skipped + 1;
      END IF;

    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors || jsonb_build_object(
        'user_id', v_payload->>'user_id',
        'error_code', SQLERRM
      );
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'processed', v_processed,
    'skipped', v_skipped,
    'errors', v_errors
  );
END;
$$;

-- 3. Add review_flagged_attendance RPC
CREATE OR REPLACE FUNCTION review_flagged_attendance(
  p_attendance_id UUID
)
RETURNS attendance_records
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_record attendance_records;
  v_event_id UUID;
  v_club_admin_authorized BOOLEAN;
  v_global_authorized BOOLEAN;
  v_actor_id UUID;
BEGIN
  v_actor_id := current_user_id();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;

  -- 1. Get Attendance Record
  SELECT *
  INTO v_record
  FROM attendance_records
  WHERE id = p_attendance_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ATTENDANCE_NOT_FOUND';
  END IF;

  SELECT event_id INTO v_event_id
  FROM attendance_sessions
  WHERE id = v_record.session_id;

  -- 2. Verify Authorization
  -- Check Global Admin
  SELECT EXISTS (
    SELECT 1 FROM users WHERE id = v_actor_id AND global_role IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN')
  ) INTO v_global_authorized;

  -- Check Club Role (CLUB_ADMIN, CORE_MEMBER, FACULTY_MENTOR)
  SELECT EXISTS (
    SELECT 1 FROM event_clubs ec
    WHERE ec.event_id = v_event_id
      AND has_club_role(ec.club_id, v_actor_id, ARRAY['CLUB_ADMIN', 'CORE_MEMBER', 'FACULTY_MENTOR'])
  ) INTO v_club_admin_authorized;

  IF NOT v_global_authorized AND NOT v_club_admin_authorized THEN
    RAISE EXCEPTION 'UNAUTHORIZED_REVIEWER';
  END IF;

  -- 3. Verify Flag State
  IF NOT (v_record.audit_metadata ? 'device_collision_detected' AND (v_record.audit_metadata->>'device_collision_detected')::boolean = true) THEN
    RAISE EXCEPTION 'ATTENDANCE_NOT_FLAGGED';
  END IF;

  -- 4. Clear the flag and update
  UPDATE attendance_records
  SET audit_metadata = audit_metadata - 'device_collision_detected'
  WHERE id = p_attendance_id
  RETURNING * INTO v_record;

  -- 5. Audit Log
  INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, new_state, ip_address, created_at)
  VALUES (
    v_actor_id,
    'ATTENDANCE_REVIEWED',
    'attendance_record',
    p_attendance_id,
    jsonb_build_object('reviewed_by', v_actor_id, 'previous_flag', 'device_collision'),
    NULL,
    now()
  );

  -- 6. Insert points if not exists to guarantee idempotency
  INSERT INTO leaderboard_scores (
    id, user_id, club_id, points, reason, source_id, created_at
  ) 
  SELECT gen_random_uuid(), v_record.user_id, NULL, 5, 'ATTENDANCE', v_record.id, now()
  WHERE NOT EXISTS (
    SELECT 1 FROM leaderboard_scores 
    WHERE source_id = v_record.id AND reason = 'ATTENDANCE'
  );

  RETURN v_record;
END;
$$;
