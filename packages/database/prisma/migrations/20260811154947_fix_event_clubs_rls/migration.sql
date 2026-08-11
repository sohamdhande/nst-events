DROP POLICY IF EXISTS "Allow INSERT on event_clubs" ON event_clubs;
CREATE POLICY "Allow INSERT on event_clubs" ON event_clubs FOR INSERT WITH CHECK (
  has_club_role(club_id, current_user_id(), ARRAY['CLUB_ADMIN', 'CORE_MEMBER']) OR
  EXISTS (SELECT 1 FROM users u WHERE u.id = current_user_id() AND u.global_role IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN'))
);

DROP POLICY IF EXISTS "Allow UPDATE on event_clubs" ON event_clubs;
CREATE POLICY "Allow UPDATE on event_clubs" ON event_clubs FOR UPDATE USING (
  has_club_role(club_id, current_user_id(), ARRAY['CLUB_ADMIN', 'CORE_MEMBER']) OR
  EXISTS (SELECT 1 FROM users u WHERE u.id = current_user_id() AND u.global_role IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN'))
) WITH CHECK (
  has_club_role(club_id, current_user_id(), ARRAY['CLUB_ADMIN', 'CORE_MEMBER']) OR
  EXISTS (SELECT 1 FROM users u WHERE u.id = current_user_id() AND u.global_role IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN'))
);

DROP POLICY IF EXISTS "Allow DELETE on event_clubs" ON event_clubs;
CREATE POLICY "Allow DELETE on event_clubs" ON event_clubs FOR DELETE USING (
  has_club_role(club_id, current_user_id(), ARRAY['CLUB_ADMIN', 'CORE_MEMBER']) OR
  EXISTS (SELECT 1 FROM users u WHERE u.id = current_user_id() AND u.global_role IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN'))
);
