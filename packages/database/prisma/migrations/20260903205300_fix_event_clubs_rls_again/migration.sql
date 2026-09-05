-- Fix event_clubs RLS to allow INSERT for new events (where primary club isn't visible in the same statement)
-- by checking if the event was created by the current user.

DROP POLICY IF EXISTS "Allow INSERT on event_clubs" ON event_clubs;
CREATE POLICY "Allow INSERT on event_clubs" ON event_clubs FOR INSERT WITH CHECK (
  has_club_role(club_id, current_user_id(), ARRAY['CLUB_ADMIN', 'CORE_MEMBER']) 
  OR
  EXISTS (
    SELECT 1 FROM events e 
    WHERE e.id = event_id 
      AND e.created_by = current_user_id()
  )
  OR
  EXISTS (
    SELECT 1 FROM event_clubs primary_ec
    WHERE primary_ec.event_id = event_id 
      AND primary_ec.is_primary = true
      AND has_club_role(primary_ec.club_id, current_user_id(), ARRAY['CLUB_ADMIN', 'CORE_MEMBER'])
  )
  OR
  EXISTS (SELECT 1 FROM users u WHERE u.id = current_user_id() AND u.global_role IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN'))
);

DROP POLICY IF EXISTS "Allow UPDATE on event_clubs" ON event_clubs;
CREATE POLICY "Allow UPDATE on event_clubs" ON event_clubs FOR UPDATE USING (
  has_club_role(club_id, current_user_id(), ARRAY['CLUB_ADMIN', 'CORE_MEMBER']) 
  OR
  EXISTS (
    SELECT 1 FROM events e 
    WHERE e.id = event_id 
      AND e.created_by = current_user_id()
  )
  OR
  EXISTS (
    SELECT 1 FROM event_clubs primary_ec
    WHERE primary_ec.event_id = event_id 
      AND primary_ec.is_primary = true
      AND has_club_role(primary_ec.club_id, current_user_id(), ARRAY['CLUB_ADMIN', 'CORE_MEMBER'])
  ) OR
  EXISTS (SELECT 1 FROM users u WHERE u.id = current_user_id() AND u.global_role IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN'))
) WITH CHECK (
  has_club_role(club_id, current_user_id(), ARRAY['CLUB_ADMIN', 'CORE_MEMBER']) 
  OR
  EXISTS (
    SELECT 1 FROM events e 
    WHERE e.id = event_id 
      AND e.created_by = current_user_id()
  )
  OR
  EXISTS (
    SELECT 1 FROM event_clubs primary_ec
    WHERE primary_ec.event_id = event_id 
      AND primary_ec.is_primary = true
      AND has_club_role(primary_ec.club_id, current_user_id(), ARRAY['CLUB_ADMIN', 'CORE_MEMBER'])
  ) OR
  EXISTS (SELECT 1 FROM users u WHERE u.id = current_user_id() AND u.global_role IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN'))
);

DROP POLICY IF EXISTS "Allow DELETE on event_clubs" ON event_clubs;
CREATE POLICY "Allow DELETE on event_clubs" ON event_clubs FOR DELETE USING (
  has_club_role(club_id, current_user_id(), ARRAY['CLUB_ADMIN', 'CORE_MEMBER']) 
  OR
  EXISTS (
    SELECT 1 FROM events e 
    WHERE e.id = event_id 
      AND e.created_by = current_user_id()
  )
  OR
  EXISTS (
    SELECT 1 FROM event_clubs primary_ec
    WHERE primary_ec.event_id = event_id 
      AND primary_ec.is_primary = true
      AND has_club_role(primary_ec.club_id, current_user_id(), ARRAY['CLUB_ADMIN', 'CORE_MEMBER'])
  ) OR
  EXISTS (SELECT 1 FROM users u WHERE u.id = current_user_id() AND u.global_role IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN'))
);
