-- ==============================================================================
-- 1. RLS POLICIES for clubs table
-- ==============================================================================
DROP POLICY IF EXISTS "Allow PLATFORM_ADMIN to UPDATE clubs" ON clubs;
CREATE POLICY "Allow PLATFORM_ADMIN and FACULTY_ADMIN to UPDATE clubs" ON clubs
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = current_user_id()
        AND u.global_role IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = current_user_id()
        AND u.global_role IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN')
    )
  );

-- ==============================================================================
-- 2. RLS POLICIES for club_memberships table
-- ==============================================================================
DROP POLICY IF EXISTS "Allow members INSERT for Admins and Faculty" ON club_memberships;
CREATE POLICY "Allow members INSERT for Admins and Faculty" ON club_memberships
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = current_user_id()
        AND u.global_role = 'PLATFORM_ADMIN'
    )
    OR
    has_club_role(club_id, current_user_id(), ARRAY['CLUB_ADMIN', 'FACULTY_MENTOR'])
  );

DROP POLICY IF EXISTS "Allow members UPDATE for Admins and Faculty" ON club_memberships;
CREATE POLICY "Allow members UPDATE for Admins and Faculty" ON club_memberships
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = current_user_id()
        AND u.global_role = 'PLATFORM_ADMIN'
    )
    OR
    has_club_role(club_id, current_user_id(), ARRAY['CLUB_ADMIN', 'FACULTY_MENTOR'])
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = current_user_id()
        AND u.global_role = 'PLATFORM_ADMIN'
    )
    OR
    has_club_role(club_id, current_user_id(), ARRAY['CLUB_ADMIN', 'FACULTY_MENTOR'])
  );

DROP POLICY IF EXISTS "Allow members DELETE for Admins and Faculty" ON club_memberships;
CREATE POLICY "Allow members DELETE for Admins and Faculty" ON club_memberships
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = current_user_id()
        AND u.global_role = 'PLATFORM_ADMIN'
    )
    OR
    has_club_role(club_id, current_user_id(), ARRAY['CLUB_ADMIN', 'FACULTY_MENTOR'])
  );

-- ==============================================================================
-- 3. RLS POLICIES for events table
-- ==============================================================================
DROP POLICY IF EXISTS "Allow UPDATE on events" ON events;
CREATE POLICY "Allow UPDATE on events" ON events
  FOR UPDATE USING (
    (
      state = 'DRAFT' AND EXISTS (
        SELECT 1 FROM event_clubs ec
        WHERE ec.event_id = events.id
        AND ec.is_primary = true
        AND has_club_role(ec.club_id, current_user_id(), ARRAY['CLUB_ADMIN', 'CORE_MEMBER'])
      )
    )
    OR
    EXISTS (
      SELECT 1 FROM event_clubs ec
      WHERE ec.event_id = events.id
      AND ec.is_primary = true
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
      AND ec.is_primary = true
      AND has_club_role(ec.club_id, current_user_id(), ARRAY['CLUB_ADMIN'])
    )
  )
  WITH CHECK (
    (
      state = 'DRAFT' AND EXISTS (
        SELECT 1 FROM event_clubs ec
        WHERE ec.event_id = events.id
        AND ec.is_primary = true
        AND has_club_role(ec.club_id, current_user_id(), ARRAY['CLUB_ADMIN', 'CORE_MEMBER'])
      )
    )
    OR
    EXISTS (
      SELECT 1 FROM event_clubs ec
      WHERE ec.event_id = events.id
      AND ec.is_primary = true
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
        AND ec.is_primary = true
        AND has_club_role(ec.club_id, current_user_id(), ARRAY['CLUB_ADMIN'])
      )
    )
  );

-- ==============================================================================
-- 4. RLS POLICIES for attendance_sessions table
-- ==============================================================================
DROP POLICY IF EXISTS "Allow INSERT on attendance_sessions" ON attendance_sessions;
CREATE POLICY "Allow INSERT on attendance_sessions" ON attendance_sessions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM event_clubs ec
      WHERE ec.event_id = event_id
      AND ec.is_primary = true
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
      AND ec.is_primary = true
      AND has_club_role(ec.club_id, current_user_id(), ARRAY['CLUB_ADMIN', 'CORE_MEMBER'])
    )
    OR EXISTS (SELECT 1 FROM users u WHERE u.id = current_user_id() AND u.global_role IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN'))
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM event_clubs ec
      WHERE ec.event_id = event_id
      AND ec.is_primary = true
      AND has_club_role(ec.club_id, current_user_id(), ARRAY['CLUB_ADMIN', 'CORE_MEMBER'])
    )
    OR EXISTS (SELECT 1 FROM users u WHERE u.id = current_user_id() AND u.global_role IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN'))
  );

-- ==============================================================================
-- 5. RPCs
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
    AND ec.is_primary = true
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
    AND ec.is_primary = true
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
    AND ec.is_primary = true
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
    AND ec.is_primary = true
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
    AND ec.is_primary = true
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
