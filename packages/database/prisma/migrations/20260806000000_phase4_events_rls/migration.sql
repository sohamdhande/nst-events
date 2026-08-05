-- ==============================================================================
-- 1. RLS POLICIES for events table
-- ==============================================================================
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow SELECT on events" ON events;
CREATE POLICY "Allow SELECT on events" ON events
  FOR SELECT USING (
    current_user_id() IS NOT NULL AND (
      (state = 'PUBLISHED' AND visibility = 'PUBLIC')
      OR
      EXISTS (
        SELECT 1 FROM event_clubs ec
        WHERE ec.event_id = events.id
        AND is_active_club_member(ec.club_id, current_user_id())
      )
      OR
      EXISTS (
        SELECT 1 FROM users u
        WHERE u.id = current_user_id()
          AND u.global_role IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN')
      )
    )
  );

DROP POLICY IF EXISTS "Allow INSERT on events" ON events;
CREATE POLICY "Allow INSERT on events" ON events
  FOR INSERT WITH CHECK (
    state = 'DRAFT' AND (
      EXISTS (
        SELECT 1 FROM club_memberships cm
        WHERE cm.user_id = current_user_id()
          AND cm.role::text IN ('CLUB_ADMIN', 'CORE_MEMBER')
          AND cm.deleted_at IS NULL
      )
      OR
      EXISTS (
        SELECT 1 FROM users u
        WHERE u.id = current_user_id()
          AND u.global_role IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN')
      )
    )
  );

DROP POLICY IF EXISTS "Allow UPDATE on events" ON events;
CREATE POLICY "Allow UPDATE on events" ON events
  FOR UPDATE USING (
    (
      state = 'DRAFT' AND EXISTS (
        SELECT 1 FROM event_clubs ec
        WHERE ec.event_id = events.id
        AND has_club_role(ec.club_id, current_user_id(), ARRAY['CLUB_ADMIN', 'CORE_MEMBER'])
      )
    )
    OR
    EXISTS (
      SELECT 1 FROM event_clubs ec
      WHERE ec.event_id = events.id
      AND has_club_role(ec.club_id, current_user_id(), ARRAY['FACULTY_MENTOR'])
    )
    OR
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = current_user_id()
        AND u.global_role IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN')
    )
    OR
    EXISTS (
      SELECT 1 FROM event_clubs ec
      WHERE ec.event_id = events.id
      AND has_club_role(ec.club_id, current_user_id(), ARRAY['CLUB_ADMIN'])
    )
  )
  WITH CHECK (
    (
      state = 'DRAFT' AND EXISTS (
        SELECT 1 FROM event_clubs ec
        WHERE ec.event_id = events.id
        AND has_club_role(ec.club_id, current_user_id(), ARRAY['CLUB_ADMIN', 'CORE_MEMBER'])
      )
    )
    OR
    EXISTS (
      SELECT 1 FROM event_clubs ec
      WHERE ec.event_id = events.id
      AND has_club_role(ec.club_id, current_user_id(), ARRAY['FACULTY_MENTOR'])
    )
    OR
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = current_user_id()
        AND u.global_role IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN')
    )
    OR
    (
      deleted_at IS NOT NULL AND
      EXISTS (
        SELECT 1 FROM event_clubs ec
        WHERE ec.event_id = events.id
        AND has_club_role(ec.club_id, current_user_id(), ARRAY['CLUB_ADMIN'])
      )
    )
  );

-- Actual DELETE is prevented for regular users. Soft delete is handled by UPDATE policy.
DROP POLICY IF EXISTS "Allow soft-DELETE on events" ON events;
CREATE POLICY "Allow soft-DELETE on events" ON events
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = current_user_id()
        AND u.global_role IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN')
    )
  );

-- ==============================================================================
-- 2. RLS POLICIES for event_clubs table
-- ==============================================================================
ALTER TABLE event_clubs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow SELECT on event_clubs" ON event_clubs;
CREATE POLICY "Allow SELECT on event_clubs" ON event_clubs
  FOR SELECT USING (current_user_id() IS NOT NULL);

DROP POLICY IF EXISTS "Allow INSERT on event_clubs" ON event_clubs;
CREATE POLICY "Allow INSERT on event_clubs" ON event_clubs
  FOR INSERT WITH CHECK (
    has_club_role(club_id, current_user_id(), ARRAY['CLUB_ADMIN'])
    OR EXISTS (SELECT 1 FROM users u WHERE u.id = current_user_id() AND u.global_role IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN'))
  );

DROP POLICY IF EXISTS "Allow UPDATE on event_clubs" ON event_clubs;
CREATE POLICY "Allow UPDATE on event_clubs" ON event_clubs
  FOR UPDATE USING (
    has_club_role(club_id, current_user_id(), ARRAY['CLUB_ADMIN'])
    OR EXISTS (SELECT 1 FROM users u WHERE u.id = current_user_id() AND u.global_role IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN'))
  )
  WITH CHECK (
    has_club_role(club_id, current_user_id(), ARRAY['CLUB_ADMIN'])
    OR EXISTS (SELECT 1 FROM users u WHERE u.id = current_user_id() AND u.global_role IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN'))
  );

DROP POLICY IF EXISTS "Allow DELETE on event_clubs" ON event_clubs;
CREATE POLICY "Allow DELETE on event_clubs" ON event_clubs
  FOR DELETE USING (
    has_club_role(club_id, current_user_id(), ARRAY['CLUB_ADMIN'])
    OR EXISTS (SELECT 1 FROM users u WHERE u.id = current_user_id() AND u.global_role IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN'))
  );

-- ==============================================================================
-- 3. RLS POLICIES for attendance_sessions table
-- ==============================================================================
ALTER TABLE attendance_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow SELECT on attendance_sessions" ON attendance_sessions;
CREATE POLICY "Allow SELECT on attendance_sessions" ON attendance_sessions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = attendance_sessions.event_id
      AND (
        (e.state = 'PUBLISHED' AND e.visibility = 'PUBLIC')
        OR EXISTS (
          SELECT 1 FROM event_clubs ec
          WHERE ec.event_id = e.id
          AND is_active_club_member(ec.club_id, current_user_id())
        )
      )
    )
    OR EXISTS (SELECT 1 FROM users u WHERE u.id = current_user_id() AND u.global_role IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN'))
  );

DROP POLICY IF EXISTS "Allow INSERT on attendance_sessions" ON attendance_sessions;
CREATE POLICY "Allow INSERT on attendance_sessions" ON attendance_sessions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM event_clubs ec
      WHERE ec.event_id = event_id
      AND has_club_role(ec.club_id, current_user_id(), ARRAY['CLUB_ADMIN', 'CORE_MEMBER'])
    )
    OR EXISTS (SELECT 1 FROM users u WHERE u.id = current_user_id() AND u.global_role IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN'))
  );

DROP POLICY IF EXISTS "Allow UPDATE on attendance_sessions" ON attendance_sessions;
CREATE POLICY "Allow UPDATE on attendance_sessions" ON attendance_sessions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM event_clubs ec
      WHERE ec.event_id = event_id
      AND has_club_role(ec.club_id, current_user_id(), ARRAY['CLUB_ADMIN', 'CORE_MEMBER'])
    )
    OR EXISTS (SELECT 1 FROM users u WHERE u.id = current_user_id() AND u.global_role IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN'))
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM event_clubs ec
      WHERE ec.event_id = event_id
      AND has_club_role(ec.club_id, current_user_id(), ARRAY['CLUB_ADMIN', 'CORE_MEMBER'])
    )
    OR EXISTS (SELECT 1 FROM users u WHERE u.id = current_user_id() AND u.global_role IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN'))
  );

DROP POLICY IF EXISTS "Allow DELETE on attendance_sessions" ON attendance_sessions;
CREATE POLICY "Allow DELETE on attendance_sessions" ON attendance_sessions
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = current_user_id()
        AND u.global_role IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN')
    )
  );

-- ==============================================================================
-- 4. SQL FUNCTION: submit_event_for_approval
-- ==============================================================================
CREATE OR REPLACE FUNCTION submit_event_for_approval(p_event_id UUID)
RETURNS events
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event events;
  v_caller_id UUID := current_user_id();
BEGIN
  SELECT * INTO v_event FROM events WHERE id = p_event_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Event not found';
  END IF;

  IF v_event.state != 'DRAFT' THEN
    RAISE EXCEPTION 'Event must be in DRAFT state';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM event_clubs ec
    WHERE ec.event_id = p_event_id
    AND has_club_role(ec.club_id, v_caller_id, ARRAY['CLUB_ADMIN', 'CORE_MEMBER'])
  ) AND NOT EXISTS (
    SELECT 1 FROM users u WHERE u.id = v_caller_id AND u.global_role IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN')
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE events SET state = 'PENDING_APPROVAL' WHERE id = p_event_id AND state = 'DRAFT' RETURNING * INTO v_event;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Race condition: Event state changed during transaction';
  END IF;

  INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, previous_state, new_state, created_at)
  VALUES (v_caller_id, 'EVENT_SUBMITTED', 'event', p_event_id, jsonb_build_object('state', 'DRAFT'), jsonb_build_object('state', 'PENDING_APPROVAL'), now());

  RETURN v_event;
END;
$$;

-- ==============================================================================
-- 5. SQL FUNCTION: approve_event
-- ==============================================================================
CREATE OR REPLACE FUNCTION approve_event(p_event_id UUID)
RETURNS events
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event events;
  v_caller_id UUID := current_user_id();
  v_is_global_admin BOOLEAN;
  v_is_mentor BOOLEAN;
BEGIN
  SELECT * INTO v_event FROM events WHERE id = p_event_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Event not found';
  END IF;

  IF v_event.state != 'PENDING_APPROVAL' THEN
    RAISE EXCEPTION 'Event must be in PENDING_APPROVAL state';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM users u WHERE u.id = v_caller_id AND u.global_role IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN')
  ) INTO v_is_global_admin;

  SELECT EXISTS (
    SELECT 1 FROM event_clubs ec
    WHERE ec.event_id = p_event_id
    AND has_club_role(ec.club_id, v_caller_id, ARRAY['FACULTY_MENTOR'])
  ) INTO v_is_mentor;

  IF NOT v_is_global_admin AND NOT v_is_mentor THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE events SET state = 'PUBLISHED' WHERE id = p_event_id AND state = 'PENDING_APPROVAL' RETURNING * INTO v_event;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Race condition: Event state changed during transaction';
  END IF;

  INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, previous_state, new_state, created_at)
  VALUES (v_caller_id, 'EVENT_APPROVED', 'event', p_event_id, jsonb_build_object('state', 'PENDING_APPROVAL'), jsonb_build_object('state', 'PUBLISHED'), now());

  RETURN v_event;
END;
$$;

-- ==============================================================================
-- 6. SQL FUNCTION: reject_event
-- ==============================================================================
CREATE OR REPLACE FUNCTION reject_event(p_event_id UUID, p_reason TEXT)
RETURNS events
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event events;
  v_caller_id UUID := current_user_id();
  v_is_global_admin BOOLEAN;
  v_is_mentor BOOLEAN;
BEGIN
  SELECT * INTO v_event FROM events WHERE id = p_event_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Event not found';
  END IF;

  IF v_event.state != 'PENDING_APPROVAL' THEN
    RAISE EXCEPTION 'Event must be in PENDING_APPROVAL state';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM users u WHERE u.id = v_caller_id AND u.global_role IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN')
  ) INTO v_is_global_admin;

  SELECT EXISTS (
    SELECT 1 FROM event_clubs ec
    WHERE ec.event_id = p_event_id
    AND has_club_role(ec.club_id, v_caller_id, ARRAY['FACULTY_MENTOR'])
  ) INTO v_is_mentor;

  IF NOT v_is_global_admin AND NOT v_is_mentor THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE events SET state = 'DRAFT' WHERE id = p_event_id AND state = 'PENDING_APPROVAL' RETURNING * INTO v_event;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Race condition: Event state changed during transaction';
  END IF;

  INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, previous_state, new_state, created_at)
  VALUES (v_caller_id, 'EVENT_REJECTED', 'event', p_event_id, jsonb_build_object('state', 'PENDING_APPROVAL'), jsonb_build_object('state', 'DRAFT', 'rejection_reason', p_reason), now());

  RETURN v_event;
END;
$$;

-- ==============================================================================
-- 7. SQL FUNCTION: lock_event
-- ==============================================================================
CREATE OR REPLACE FUNCTION lock_event(p_event_id UUID)
RETURNS events
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event events;
  v_caller_id UUID := current_user_id();
BEGIN
  SELECT * INTO v_event FROM events WHERE id = p_event_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Event not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM event_clubs ec
    WHERE ec.event_id = p_event_id
    AND has_club_role(ec.club_id, v_caller_id, ARRAY['CLUB_ADMIN', 'CORE_MEMBER', 'FACULTY_MENTOR'])
  ) AND NOT EXISTS (
    SELECT 1 FROM users u WHERE u.id = v_caller_id AND u.global_role IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN')
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE events SET is_locked = true WHERE id = p_event_id AND is_locked = false RETURNING * INTO v_event;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Race condition: Event is already locked';
  END IF;

  INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, previous_state, new_state, created_at)
  VALUES (v_caller_id, 'EVENT_LOCKED', 'event', p_event_id, jsonb_build_object('is_locked', false), jsonb_build_object('is_locked', true), now());

  RETURN v_event;
END;
$$;

-- ==============================================================================
-- 8. SQL FUNCTION: unlock_event
-- ==============================================================================
CREATE OR REPLACE FUNCTION unlock_event(p_event_id UUID)
RETURNS events
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event events;
  v_caller_id UUID := current_user_id();
BEGIN
  SELECT * INTO v_event FROM events WHERE id = p_event_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Event not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM event_clubs ec
    WHERE ec.event_id = p_event_id
    AND has_club_role(ec.club_id, v_caller_id, ARRAY['CLUB_ADMIN', 'CORE_MEMBER', 'FACULTY_MENTOR'])
  ) AND NOT EXISTS (
    SELECT 1 FROM users u WHERE u.id = v_caller_id AND u.global_role IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN')
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE events SET is_locked = false WHERE id = p_event_id AND is_locked = true RETURNING * INTO v_event;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Race condition: Event is already unlocked';
  END IF;

  INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, previous_state, new_state, created_at)
  VALUES (v_caller_id, 'EVENT_UNLOCKED', 'event', p_event_id, jsonb_build_object('is_locked', true), jsonb_build_object('is_locked', false), now());

  RETURN v_event;
END;
$$;

-- Removed redundant audit_event_state_changes trigger as RPCs already write to audit_logs atomically.
