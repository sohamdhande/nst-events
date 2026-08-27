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
  v_event_end_time TIMESTAMPTZ;
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

  IF p_mock_location_detected THEN
    RAISE EXCEPTION 'MOCK_LOCATION_REJECTED';
  END IF;

  SELECT 
    s.event_id, s.open_at, s.close_at, s.geofence_radius,
    e.state, e.is_locked, e.location_geofence, e.end_time
  INTO 
    v_event_id, v_session_open_at, v_session_close_at, v_geofence_radius,
    v_event_state, v_is_locked, v_location_geofence, v_event_end_time
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

  IF v_location_geofence IS NOT NULL THEN
    IF NOT ST_DWithin(v_location_geofence, ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326), v_geofence_radius) THEN
      RAISE EXCEPTION 'OUTSIDE_GEOFENCE';
    END IF;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM event_registrations 
    WHERE event_id = v_event_id AND user_id = v_user_id AND deleted_at IS NULL
  ) INTO v_is_registered;

  IF NOT v_is_registered THEN
    RAISE EXCEPTION 'NOT_REGISTERED';
  END IF;

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
