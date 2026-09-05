-- Drop the globally single-use QR signature table
DROP TABLE IF EXISTS "consumed_qr_signatures" CASCADE;

-- Re-create the offline sync RPC without the consumed_qr_signatures block
CREATE OR REPLACE FUNCTION public.sync_offline_attendance_v9(p_payloads jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_actor_id UUID;
  v_event_id UUID;
  v_session_id UUID;
  v_is_locked BOOLEAN;
  v_venue_latitude FLOAT;
  v_venue_longitude FLOAT;
  v_geofence_radius FLOAT;
  v_event_end_time TIMESTAMPTZ;
  v_payload JSONB;
  v_user_id UUID;
  v_scan_timestamp TIMESTAMPTZ;
  v_device_id TEXT;
  v_lat FLOAT;
  v_lng FLOAT;
  v_gps_accuracy FLOAT;
  v_mock_location_detected BOOLEAN;
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
    RAISE EXCEPTION 'UNAUTHORIZED' USING ERRCODE = 'U0001';
  END IF;

  FOR v_payload IN SELECT * FROM jsonb_array_elements(p_payloads) ORDER BY value->>'device_id'
  LOOP
    BEGIN
      v_session_id := (v_payload->>'session_id')::UUID;
      v_user_id := v_actor_id; -- MANDATORY FIX: BIND TO CURRENT USER ONLY
      v_scan_timestamp := (v_payload->>'scan_timestamp')::TIMESTAMPTZ;

      SELECT s.event_id, e.is_locked, s.geofence_radius, s.venue_latitude, s.venue_longitude, e.end_time
      INTO v_event_id, v_is_locked, v_geofence_radius, v_venue_latitude, v_venue_longitude, v_event_end_time
      FROM attendance_sessions s
      JOIN events e ON s.event_id = e.id
      WHERE s.id = v_session_id AND s.deleted_at IS NULL AND e.deleted_at IS NULL;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'SESSION_CLOSED' USING ERRCODE = 'U0005';
      END IF;

      -- MANDATORY FIX: USE v_scan_timestamp INSTEAD OF now()
      IF v_is_locked OR v_scan_timestamp >= v_event_end_time + interval '24 hours' THEN
        RAISE EXCEPTION 'EVENT_LOCKED' USING ERRCODE = 'U0006';
      END IF;

      v_device_id := v_payload->>'device_id';
      v_lat := (v_payload->>'gps_lat')::FLOAT;
      v_lng := (v_payload->>'gps_lng')::FLOAT;
      v_gps_accuracy := (v_payload->>'gps_accuracy')::FLOAT;
      v_mock_location_detected := (v_payload->>'mock_location_detected')::BOOLEAN;
      v_signature := v_payload->>'scanned_token';

      -- GEOLOCATION INTEGRITY HARDENING --
      IF v_lat IS NULL OR v_lng IS NULL THEN
        RAISE EXCEPTION 'LOCATION_UNAVAILABLE' USING ERRCODE = 'U0009';
      END IF;

      IF (v_lat >= -90 AND v_lat <= 90 AND v_lng >= -180 AND v_lng <= 180) IS NOT TRUE THEN
        RAISE EXCEPTION 'INVALID_LOCATION' USING ERRCODE = 'U0010';
      END IF;

      IF v_gps_accuracy IS NULL OR (v_gps_accuracy >= 0 AND v_gps_accuracy <= 100) IS NOT TRUE THEN
        RAISE EXCEPTION 'LOCATION_UNRELIABLE' USING ERRCODE = 'U0011';
      END IF;

      IF v_mock_location_detected = true THEN
        RAISE EXCEPTION 'MOCK_LOCATION_REJECTED' USING ERRCODE = 'U0008';
      END IF;

      -- (Removed global QR consumption insert here)

      IF v_venue_latitude IS NOT NULL AND v_venue_longitude IS NOT NULL THEN
        IF NOT ST_DWithin(ST_SetSRID(ST_MakePoint(v_venue_longitude, v_venue_latitude), 4326)::geography, ST_SetSRID(ST_MakePoint(v_lng, v_lat), 4326)::geography, v_geofence_radius) THEN
          RAISE EXCEPTION 'OUTSIDE_GEOFENCE' USING ERRCODE = 'U0007';
        END IF;
      END IF;

      PERFORM check_attendance_eligibility(v_event_id, v_user_id);

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
        'user_id', v_actor_id,
        'error_code', SQLSTATE
      );
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'processed', v_processed,
    'skipped', v_skipped,
    'errors', v_errors
  );
END;
$function$;
