-- packages/database/prisma/migrations/20260827122500_phase56c_geofence_hardening/migration.sql

CREATE OR REPLACE FUNCTION public.mark_attendance(p_session_id uuid, p_totp_token text, p_latitude double precision, p_longitude double precision, p_device_id text, p_device_os text, p_gps_accuracy double precision, p_mock_location_detected boolean, p_app_version text)
 RETURNS attendance_records
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID;
  v_event_id UUID;
  v_session_open_at TIMESTAMPTZ;
  v_session_close_at TIMESTAMPTZ;
  v_geofence_radius FLOAT;
  v_venue_latitude FLOAT;
  v_venue_longitude FLOAT;
  v_event_state text;
  v_is_locked BOOLEAN;
  v_event_end_time TIMESTAMPTZ;
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

  SELECT
    s.event_id, s.open_at, s.close_at, s.geofence_radius, s.venue_latitude, s.venue_longitude,
    e.state, e.is_locked, e.end_time
  INTO
    v_event_id, v_session_open_at, v_session_close_at, v_geofence_radius, v_venue_latitude, v_venue_longitude,
    v_event_state, v_is_locked, v_event_end_time
  FROM attendance_sessions s
  JOIN events e ON s.event_id = e.id
  WHERE s.id = p_session_id AND s.deleted_at IS NULL AND e.deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SESSION_CLOSED';
  END IF;

  IF now() < v_session_open_at OR now() > v_session_close_at THEN
    RAISE EXCEPTION 'SESSION_CLOSED';
  END IF;

  -- ENFORCE: Lazy locking using database time
  IF v_event_state != 'PUBLISHED' OR v_is_locked OR now() >= v_event_end_time + interval '24 hours' THEN
    RAISE EXCEPTION 'EVENT_LOCKED';
  END IF;

  -- GEOLOCATION INTEGRITY HARDENING --
  IF p_latitude IS NULL OR p_longitude IS NULL THEN
    RAISE EXCEPTION 'LOCATION_UNAVAILABLE';
  END IF;

  IF (p_latitude >= -90 AND p_latitude <= 90 AND p_longitude >= -180 AND p_longitude <= 180) IS NOT TRUE THEN
    RAISE EXCEPTION 'INVALID_LOCATION';
  END IF;

  IF p_gps_accuracy IS NULL OR (p_gps_accuracy >= 0 AND p_gps_accuracy <= 100) IS NOT TRUE THEN
    RAISE EXCEPTION 'LOCATION_UNRELIABLE';
  END IF;

  IF p_mock_location_detected = true THEN
    RAISE EXCEPTION 'MOCK_LOCATION_REJECTED';
  END IF;

  IF v_venue_latitude IS NOT NULL AND v_venue_longitude IS NOT NULL THEN
    IF NOT ST_DWithin(ST_SetSRID(ST_MakePoint(v_venue_longitude, v_venue_latitude), 4326)::geography, ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326)::geography, v_geofence_radius) THEN
      RAISE EXCEPTION 'OUTSIDE_GEOFENCE';
    END IF;
  END IF;

  -- ── SHARED ELIGIBILITY PRIMITIVE ────────────────────────────────
  PERFORM check_attendance_eligibility(v_event_id, v_user_id);

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

  INSERT INTO attendance_records (
    session_id, user_id, marked_by, marked_at, method, status, audit_metadata
  ) VALUES (
    p_session_id, v_user_id, NULL, now(), 'QR', 'PRESENT', v_audit_metadata
  )
  ON CONFLICT (session_id, user_id) DO NOTHING
  RETURNING * INTO v_new_record;

  IF FOUND THEN
    PERFORM set_config('app.attendance_is_new', 'true', true);

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
$function$;

CREATE OR REPLACE FUNCTION public.sync_offline_attendance(p_payloads jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
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
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;

  FOR v_payload IN SELECT * FROM jsonb_array_elements(p_payloads) ORDER BY value->>'device_id'
  LOOP
    BEGIN
      v_session_id := (v_payload->>'session_id')::UUID;

      SELECT s.event_id, e.is_locked, s.geofence_radius, s.venue_latitude, s.venue_longitude, e.end_time
      INTO v_event_id, v_is_locked, v_geofence_radius, v_venue_latitude, v_venue_longitude, v_event_end_time
      FROM attendance_sessions s
      JOIN events e ON s.event_id = e.id
      WHERE s.id = v_session_id AND s.deleted_at IS NULL AND e.deleted_at IS NULL;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'SESSION_CLOSED';
      END IF;

      -- ENFORCE: Lazy locking using database time
      IF v_is_locked OR now() >= v_event_end_time + interval '24 hours' THEN
        RAISE EXCEPTION 'EVENT_LOCKED';
      END IF;

      v_user_id := (v_payload->>'user_id')::UUID;
      v_scan_timestamp := (v_payload->>'scan_timestamp')::TIMESTAMPTZ;
      v_device_id := v_payload->>'device_id';
      v_lat := (v_payload->>'gps_lat')::FLOAT;
      v_lng := (v_payload->>'gps_lng')::FLOAT;
      v_gps_accuracy := (v_payload->>'gps_accuracy')::FLOAT;
      v_mock_location_detected := (v_payload->>'mock_location_detected')::BOOLEAN;
      v_signature := v_payload->>'scanned_token';

      -- GEOLOCATION INTEGRITY HARDENING --
      IF v_lat IS NULL OR v_lng IS NULL THEN
        RAISE EXCEPTION 'LOCATION_UNAVAILABLE';
      END IF;

      IF (v_lat >= -90 AND v_lat <= 90 AND v_lng >= -180 AND v_lng <= 180) IS NOT TRUE THEN
        RAISE EXCEPTION 'INVALID_LOCATION';
      END IF;

      IF v_gps_accuracy IS NULL OR (v_gps_accuracy >= 0 AND v_gps_accuracy <= 100) IS NOT TRUE THEN
        RAISE EXCEPTION 'LOCATION_UNRELIABLE';
      END IF;

      IF v_mock_location_detected = true THEN
        RAISE EXCEPTION 'MOCK_LOCATION_REJECTED';
      END IF;

      BEGIN
        INSERT INTO consumed_qr_signatures (session_id, signature)
        VALUES (v_session_id, v_signature);
      EXCEPTION WHEN unique_violation THEN
        RAISE EXCEPTION 'SIGNATURE_ALREADY_CONSUMED';
      END;

      IF v_venue_latitude IS NOT NULL AND v_venue_longitude IS NOT NULL THEN
        IF NOT ST_DWithin(ST_SetSRID(ST_MakePoint(v_venue_longitude, v_venue_latitude), 4326)::geography, ST_SetSRID(ST_MakePoint(v_lng, v_lat), 4326)::geography, v_geofence_radius) THEN
          RAISE EXCEPTION 'OUTSIDE_GEOFENCE';
        END IF;
      END IF;

      -- ── SHARED ELIGIBILITY PRIMITIVE ──────────────────────────────
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
$function$;
