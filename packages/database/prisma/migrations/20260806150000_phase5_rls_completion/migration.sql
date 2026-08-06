-- Phase 5 Final Security Closeout

-- 1. teams RLS
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow SELECT on teams" ON teams;
CREATE POLICY "Allow SELECT on teams" ON teams
  FOR SELECT USING (current_user_id() IS NOT NULL);

DROP POLICY IF EXISTS "Allow INSERT on teams" ON teams;
CREATE POLICY "Allow INSERT on teams" ON teams
  FOR INSERT WITH CHECK (current_user_id() IS NOT NULL);

DROP POLICY IF EXISTS "Allow UPDATE on teams" ON teams;
CREATE POLICY "Allow UPDATE on teams" ON teams
  FOR UPDATE USING (leader_id = current_user_id()) WITH CHECK (leader_id = current_user_id());

DROP POLICY IF EXISTS "Allow DELETE on teams" ON teams;
CREATE POLICY "Allow DELETE on teams" ON teams
  FOR DELETE USING (leader_id = current_user_id());

-- 2. event_registrations RLS
ALTER TABLE event_registrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow SELECT on event_registrations" ON event_registrations;
CREATE POLICY "Allow SELECT on event_registrations" ON event_registrations
  FOR SELECT USING (
    user_id = current_user_id()
    OR
    EXISTS (
      SELECT 1 FROM event_clubs ec
      WHERE ec.event_id = event_registrations.event_id
      AND has_club_role(ec.club_id, current_user_id(), ARRAY['CLUB_ADMIN', 'CORE_MEMBER', 'FACULTY_MENTOR'])
    )
    OR
    EXISTS (SELECT 1 FROM users u WHERE u.id = current_user_id() AND u.global_role IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN'))
  );

DROP POLICY IF EXISTS "Allow INSERT on event_registrations" ON event_registrations;
CREATE POLICY "Allow INSERT on event_registrations" ON event_registrations
  FOR INSERT WITH CHECK (user_id = current_user_id());

DROP POLICY IF EXISTS "Allow DELETE on event_registrations" ON event_registrations;
CREATE POLICY "Allow DELETE on event_registrations" ON event_registrations
  FOR DELETE USING (user_id = current_user_id());

DROP POLICY IF EXISTS "Allow UPDATE on event_registrations" ON event_registrations;
CREATE POLICY "Allow UPDATE on event_registrations" ON event_registrations
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM event_clubs ec
      WHERE ec.event_id = event_registrations.event_id
      AND has_club_role(ec.club_id, current_user_id(), ARRAY['CLUB_ADMIN', 'FACULTY_MENTOR'])
    )
    OR
    EXISTS (SELECT 1 FROM users u WHERE u.id = current_user_id() AND u.global_role IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN'))
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM event_clubs ec
      WHERE ec.event_id = event_registrations.event_id
      AND has_club_role(ec.club_id, current_user_id(), ARRAY['CLUB_ADMIN', 'FACULTY_MENTOR'])
    )
    OR
    EXISTS (SELECT 1 FROM users u WHERE u.id = current_user_id() AND u.global_role IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN'))
  );
