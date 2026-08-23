-- Drop the duplicate verify_qr_signature function since verification is now done in Node.js
DROP FUNCTION IF EXISTS public.verify_qr_signature(uuid, timestamptz, text, text);

-- Update sync_offline_attendance to remove the duplicate cryptographic validation
CREATE OR REPLACE FUNCTION public.sync_offline_attendance(p_records jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_actor_id UUID;
  v_user_id UUID;
  v_session_id UUID;
  v_scanned_token TEXT;
  v_scan_timestamp TIMESTAMPTZ;
  v_device_id TEXT;
  v_gps_lat FLOAT;
  v_gps_lng FLOAT;
  v_offline_seq INT;

  v_record JSONB;

  v_event_id UUID;
  v_session_open_at TIMESTAMPTZ;
  v_session_close_at TIMESTAMPTZ;
  v_geofence_radius FLOAT;
  v_qr_secret TEXT;
  v_event_state text;
  v_is_locked BOOLEAN;
  v_location_geofence geography(Point, 4326);
  v_is_registered BOOLEAN;
  v_collision_detected BOOLEAN;
  v_colliding_user_id UUID;
  v_new_record public.attendance_records;
  v_audit_metadata JSONB;

  v_processed INT := 0;
  v_skipped INT := 0;
  v_errors JSONB := '[]'::jsonb;
  v_error_msg TEXT;

  v_signature TEXT;
  v_parts TEXT[];
BEGIN
  v_actor_id := public.current_user_id();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;

  FOR v_record IN SELECT * FROM jsonb_array_elements(p_records)
  LOOP
    v_offline_seq := (v_record->>'offline_seq')::INT;

    BEGIN
      v_session_id := (v_record->>'session_id')::UUID;
      v_user_id := (v_record->>'user_id')::UUID;
      v_scanned_token := v_record->>'scanned_token';
      v_scan_timestamp := (v_record->>'scan_timestamp')::TIMESTAMPTZ;
      v_device_id := v_record->>'device_id';
      v_gps_lat := (v_record->>'gps_lat')::FLOAT;
      v_gps_lng := (v_record->>'gps_lng')::FLOAT;

      -- 1. Validate Session and Event
      SELECT
        s.event_id, s.open_at, s.close_at, s.geofence_radius, s.qr_secret,
        e.state, e.is_locked, e.location_geofence
      INTO
        v_event_id, v_session_open_at, v_session_close_at, v_geofence_radius, v_qr_secret,
        v_event_state, v_is_locked, v_location_geofence
      FROM public.attendance_sessions s
      JOIN public.events e ON s.event_id = e.id
      WHERE s.id = v_session_id AND s.deleted_at IS NULL AND e.deleted_at IS NULL;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'SESSION_CLOSED';
      END IF;

      -- Check Event Authorization for this actor
      IF NOT EXISTS (
        SELECT 1 FROM public.event_clubs ec
        JOIN public.club_memberships cm ON ec.club_id = cm.club_id
        WHERE ec.event_id = v_event_id
          AND cm.user_id = v_actor_id
          AND cm.role IN ('CLUB_ADMIN', 'CORE_MEMBER')
          AND cm.deleted_at IS NULL
      ) AND NOT EXISTS (
        SELECT 1 FROM public.users u WHERE u.id = v_actor_id AND u.global_role IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN')
      ) THEN
        RAISE EXCEPTION 'UNAUTHORIZED_FOR_EVENT';
      END IF;

      IF v_scan_timestamp < v_session_open_at OR v_scan_timestamp > v_session_close_at THEN
        RAISE EXCEPTION 'SESSION_CLOSED';
      END IF;

      IF v_event_state != 'PUBLISHED' OR v_is_locked THEN
        RAISE EXCEPTION 'EVENT_LOCKED';
      END IF;

      -- NOTE: Cryptographic validation was here, but has been moved to Node.js application layer.

      -- 3. Guard against Replay (Single-Use)
      v_parts := string_to_array(v_scanned_token, ':');
      v_signature := v_parts[3];

      -- Insert into consumed_qr_signatures. Will throw unique_violation if already consumed.
      BEGIN
        INSERT INTO public.consumed_qr_signatures (session_id, signature, consumed_at)
        VALUES (v_session_id, v_signature, now());
      EXCEPTION WHEN unique_violation THEN
        RAISE EXCEPTION 'SIGNATURE_ALREADY_CONSUMED';
      END;

      -- 4. Geofence Validation
      IF v_location_geofence IS NOT NULL AND v_gps_lat IS NOT NULL AND v_gps_lng IS NOT NULL THEN
        IF NOT ST_DWithin(v_location_geofence, ST_SetSRID(ST_MakePoint(v_gps_lng, v_gps_lat), 4326)::geography, v_geofence_radius) THEN
          RAISE EXCEPTION 'OUTSIDE_GEOFENCE';
        END IF;
      END IF;

      -- 5. Registration Check
      SELECT EXISTS (
        SELECT 1 FROM public.event_registrations
        WHERE event_id = v_event_id AND user_id = v_user_id AND deleted_at IS NULL
      ) INTO v_is_registered;

      IF NOT v_is_registered THEN
        RAISE EXCEPTION 'NOT_REGISTERED';
      END IF;

      -- 6. Device Collision Check
      v_collision_detected := false;
      SELECT user_id INTO v_colliding_user_id
      FROM public.attendance_records
      WHERE session_id = v_session_id
        AND audit_metadata->>'device_id' = v_device_id
        AND user_id != v_user_id
      LIMIT 1;

      IF FOUND THEN
        v_collision_detected := true;

        INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, new_state, ip_address, created_at)
        VALUES (
          v_actor_id,
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

      -- 7. Build Audit Metadata
      v_audit_metadata := jsonb_build_object(
        'device_id', v_device_id,
        'scanned_token', v_scanned_token,
        'offline_sync', true
      );

      IF v_collision_detected THEN
        v_audit_metadata := jsonb_set(v_audit_metadata, '{device_collision_detected}', 'true'::jsonb);
      END IF;

      -- 8. Insert Attendance Record
      INSERT INTO public.attendance_records (
        session_id, user_id, marked_by, marked_at, method, status, audit_metadata
      ) VALUES (
        v_session_id, v_user_id, v_actor_id, v_scan_timestamp, 'QR', 'PRESENT', v_audit_metadata
      )
      ON CONFLICT (session_id, user_id) DO NOTHING
      RETURNING * INTO v_new_record;

      IF FOUND THEN
        INSERT INTO public.leaderboard_scores (
          id, user_id, club_id, points, reason, source_id, created_at
        ) VALUES (
          gen_random_uuid(), v_user_id, NULL, 5, 'ATTENDANCE', v_new_record.id, now()
        );
        v_processed := v_processed + 1;
      ELSE
        v_skipped := v_skipped + 1;
      END IF;

    EXCEPTION WHEN OTHERS THEN
      v_error_msg := SQLERRM;
      v_errors := v_errors || jsonb_build_object(
        'offline_seq', v_offline_seq,
        'error_code', v_error_msg,
        'message', v_error_msg
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
