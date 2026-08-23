-- 1. Modify sync_offline_attendance
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
  v_gps_accuracy FLOAT;
  v_mock_location_detected BOOLEAN;
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
      v_gps_accuracy := (v_payload->>'gps_accuracy')::FLOAT;
      v_mock_location_detected := (v_payload->>'mock_location_detected')::BOOLEAN;
      v_signature := v_payload->>'scanned_token'; -- In Phase 26B, scanned_token serves as the unique signature for replay protection

      -- Validate Mock Location
      IF v_mock_location_detected THEN
        RAISE EXCEPTION 'MOCK_LOCATION_REJECTED';
      END IF;

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
        'gps_accuracy', v_gps_accuracy,
        'mock_location_detected', v_mock_location_detected,
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
