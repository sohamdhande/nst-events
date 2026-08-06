-- Phase 5 Milestone 1 Migration
-- Generated for attendance, disputes, leaderboard, and event results

-- 1. Constraints and Indexes
ALTER TABLE attendance_sessions
  ADD CONSTRAINT attendance_sessions_time_check CHECK (start_time < end_time),
  ADD CONSTRAINT attendance_sessions_open_close_check CHECK (open_at < close_at);

CREATE INDEX leaderboard_scores_created_at_brin_idx ON leaderboard_scores USING brin(created_at);

-- 2. Audit Triggers
CREATE OR REPLACE FUNCTION audit_attendance_records_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, previous_state, ip_address, created_at)
    VALUES (current_user_id(), 'DELETE', 'attendance_record', OLD.id, row_to_json(OLD)::jsonb, null, now());
    RETURN OLD;
  ELSIF (TG_OP = 'UPDATE') THEN
    INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, previous_state, new_state, ip_address, created_at)
    VALUES (current_user_id(), 'UPDATE', 'attendance_record', NEW.id, row_to_json(OLD)::jsonb, row_to_json(NEW)::jsonb, null, now());
    RETURN NEW;
  ELSIF (TG_OP = 'INSERT') THEN
    INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, new_state, ip_address, created_at)
    VALUES (current_user_id(), 'INSERT', 'attendance_record', NEW.id, row_to_json(NEW)::jsonb, null, now());
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS audit_attendance_records_trigger ON attendance_records;
CREATE TRIGGER audit_attendance_records_trigger
  AFTER INSERT OR UPDATE OR DELETE ON attendance_records
  FOR EACH ROW EXECUTE FUNCTION audit_attendance_records_changes();

-- 3. Materialized Views
CREATE MATERIALIZED VIEW club_leaderboard_mv AS
SELECT
  c.id AS club_id,
  c.name AS club_name,
  COALESCE(SUM(ls.points), 0)::INTEGER AS total_points,
  (SELECT COUNT(DISTINCT ec.event_id) FROM event_clubs ec WHERE ec.club_id = c.id)::INTEGER AS event_count,
  (SELECT COUNT(DISTINCT cm.user_id) FROM club_memberships cm WHERE cm.club_id = c.id AND cm.deleted_at IS NULL)::INTEGER AS member_count,
  now() AS last_refreshed_at
FROM clubs c
LEFT JOIN leaderboard_scores ls ON c.id = ls.club_id
WHERE c.deleted_at IS NULL
GROUP BY c.id, c.name;

CREATE UNIQUE INDEX club_leaderboard_mv_club_id_idx ON club_leaderboard_mv(club_id);

CREATE MATERIALIZED VIEW student_leaderboard_mv AS
SELECT
  u.id AS user_id,
  u.full_name AS display_name,
  COALESCE(SUM(ls.points), 0)::INTEGER AS total_points,
  0::INTEGER AS attendance_points,
  0::INTEGER AS contribution_points,
  0::INTEGER AS competition_points,
  now() AS last_refreshed_at
FROM users u
LEFT JOIN leaderboard_scores ls ON u.id = ls.user_id
WHERE u.deleted_at IS NULL
GROUP BY u.id, u.full_name;

CREATE UNIQUE INDEX student_leaderboard_mv_user_id_idx ON student_leaderboard_mv(user_id);

-- 4. pg_cron setup for MVs
DO $$ 
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_cron;
  PERFORM cron.schedule('refresh_club_leaderboard', '*/5 * * * *', 'REFRESH MATERIALIZED VIEW CONCURRENTLY club_leaderboard_mv');
  PERFORM cron.schedule('refresh_student_leaderboard', '2-59/5 * * * *', 'REFRESH MATERIALIZED VIEW CONCURRENTLY student_leaderboard_mv');
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron not available or schedule failed, skipping cron setup';
END $$;

-- 5. RLS Policies

-- attendance_records
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow SELECT on attendance_records" ON attendance_records;
CREATE POLICY "Allow SELECT on attendance_records" ON attendance_records
  FOR SELECT USING (
    user_id = current_user_id()
    OR
    EXISTS (
      SELECT 1 FROM attendance_sessions s
      JOIN event_clubs ec ON s.event_id = ec.event_id
      WHERE s.id = attendance_records.session_id
      AND has_club_role(ec.club_id, current_user_id(), ARRAY['CLUB_ADMIN', 'CORE_MEMBER', 'FACULTY_MENTOR'])
    )
    OR
    EXISTS (SELECT 1 FROM users u WHERE u.id = current_user_id() AND u.global_role IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN'))
  );

DROP POLICY IF EXISTS "Allow UPDATE on attendance_records" ON attendance_records;
CREATE POLICY "Allow UPDATE on attendance_records" ON attendance_records
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM users u WHERE u.id = current_user_id() AND u.global_role = 'PLATFORM_ADMIN')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM users u WHERE u.id = current_user_id() AND u.global_role = 'PLATFORM_ADMIN')
  );

DROP POLICY IF EXISTS "Allow DELETE on attendance_records" ON attendance_records;
CREATE POLICY "Allow DELETE on attendance_records" ON attendance_records
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM users u WHERE u.id = current_user_id() AND u.global_role = 'PLATFORM_ADMIN')
  );

-- attendance_disputes
ALTER TABLE attendance_disputes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow SELECT on attendance_disputes" ON attendance_disputes;
CREATE POLICY "Allow SELECT on attendance_disputes" ON attendance_disputes
  FOR SELECT USING (
    user_id = current_user_id()
    OR
    EXISTS (
      SELECT 1 FROM event_clubs ec
      WHERE ec.event_id = attendance_disputes.event_id
      AND has_club_role(ec.club_id, current_user_id(), ARRAY['CLUB_ADMIN', 'CORE_MEMBER', 'FACULTY_MENTOR'])
    )
    OR
    EXISTS (SELECT 1 FROM users u WHERE u.id = current_user_id() AND u.global_role IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN'))
  );

DROP POLICY IF EXISTS "Allow INSERT on attendance_disputes" ON attendance_disputes;
CREATE POLICY "Allow INSERT on attendance_disputes" ON attendance_disputes
  FOR INSERT WITH CHECK (
    user_id = current_user_id()
  );

DROP POLICY IF EXISTS "Allow UPDATE on attendance_disputes" ON attendance_disputes;
CREATE POLICY "Allow UPDATE on attendance_disputes" ON attendance_disputes
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM event_clubs ec
      WHERE ec.event_id = attendance_disputes.event_id
      AND has_club_role(ec.club_id, current_user_id(), ARRAY['CLUB_ADMIN', 'FACULTY_MENTOR'])
    )
    OR
    EXISTS (SELECT 1 FROM users u WHERE u.id = current_user_id() AND u.global_role IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN'))
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM event_clubs ec
      WHERE ec.event_id = attendance_disputes.event_id
      AND has_club_role(ec.club_id, current_user_id(), ARRAY['CLUB_ADMIN', 'FACULTY_MENTOR'])
    )
    OR
    EXISTS (SELECT 1 FROM users u WHERE u.id = current_user_id() AND u.global_role IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN'))
  );

-- event_results
ALTER TABLE event_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow SELECT on event_results" ON event_results;
CREATE POLICY "Allow SELECT on event_results" ON event_results
  FOR SELECT USING (current_user_id() IS NOT NULL);

DROP POLICY IF EXISTS "Allow INSERT on event_results" ON event_results;
CREATE POLICY "Allow INSERT on event_results" ON event_results
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM event_clubs ec
      WHERE ec.event_id = event_id
      AND has_club_role(ec.club_id, current_user_id(), ARRAY['CLUB_ADMIN', 'FACULTY_MENTOR'])
    )
    OR
    EXISTS (SELECT 1 FROM users u WHERE u.id = current_user_id() AND u.global_role IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN'))
  );

DROP POLICY IF EXISTS "Allow UPDATE on event_results" ON event_results;
CREATE POLICY "Allow UPDATE on event_results" ON event_results
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM event_clubs ec
      WHERE ec.event_id = event_id
      AND has_club_role(ec.club_id, current_user_id(), ARRAY['CLUB_ADMIN', 'FACULTY_MENTOR'])
    )
    OR
    EXISTS (SELECT 1 FROM users u WHERE u.id = current_user_id() AND u.global_role IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN'))
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM event_clubs ec
      WHERE ec.event_id = event_id
      AND has_club_role(ec.club_id, current_user_id(), ARRAY['CLUB_ADMIN', 'FACULTY_MENTOR'])
    )
    OR
    EXISTS (SELECT 1 FROM users u WHERE u.id = current_user_id() AND u.global_role IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN'))
  );

DROP POLICY IF EXISTS "Allow DELETE on event_results" ON event_results;
CREATE POLICY "Allow DELETE on event_results" ON event_results
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM users u WHERE u.id = current_user_id() AND u.global_role = 'PLATFORM_ADMIN')
  );

-- leaderboard_scores
ALTER TABLE leaderboard_scores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow SELECT on leaderboard_scores" ON leaderboard_scores;
CREATE POLICY "Allow SELECT on leaderboard_scores" ON leaderboard_scores
  FOR SELECT USING (current_user_id() IS NOT NULL);

-- 6. RPC Skeletons

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
  v_record attendance_records;
BEGIN
  -- Skeleton implementation for Milestone 1.
  -- Business logic for TOTP, geofence, device collision, and point calculation is deferred to Milestone 2.
  
  -- Prevent actual execution of the skeleton in a real context without failing compilation
  RAISE EXCEPTION 'Not implemented. Milestone 1 skeleton.';
END;
$$;

CREATE OR REPLACE FUNCTION resolve_attendance_dispute(
  p_dispute_id UUID,
  p_resolution TEXT,
  p_review_notes TEXT
)
RETURNS attendance_disputes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dispute attendance_disputes;
BEGIN
  -- Skeleton implementation for Milestone 1.
  
  RAISE EXCEPTION 'Not implemented. Milestone 1 skeleton.';
END;
$$;
