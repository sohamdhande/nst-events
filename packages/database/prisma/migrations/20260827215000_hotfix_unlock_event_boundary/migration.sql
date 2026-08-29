-- Hotfix: Prevent unlocking an event that has been permanently locked (ended > 24h ago)

CREATE OR REPLACE FUNCTION public.unlock_event(p_event_id uuid)
RETURNS events
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $$
DECLARE
  v_event events;
  v_caller_id UUID := current_user_id();
BEGIN
  SELECT * INTO v_event FROM events WHERE id = p_event_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Event not found';
  END IF;

  IF v_event.end_time IS NOT NULL AND now() >= (v_event.end_time + interval '24 hours') THEN
    RAISE EXCEPTION 'EVENT_LOCKED';
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
