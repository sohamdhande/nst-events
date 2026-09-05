-- Re-write event_clubs RLS to allow anyone who can manage the PRIMARY club to add ANY club as a collaborator
-- We enforce that the event itself is created/edited by a valid admin of the primary club,
-- but they are free to add other clubs to the event_clubs table as non-primary collaborators.

DROP POLICY IF EXISTS "Allow INSERT on event_clubs" ON event_clubs;
CREATE POLICY "Allow INSERT on event_clubs" ON event_clubs FOR INSERT WITH CHECK (
  -- Either the user manages THIS club (the old rule)
  has_club_role(club_id, current_user_id(), ARRAY['CLUB_ADMIN', 'CORE_MEMBER']) 
  OR
  -- Or, the user manages the PRIMARY club for this event
  EXISTS (
    SELECT 1 FROM event_clubs primary_ec
    WHERE primary_ec.event_id = event_id 
      AND primary_ec.is_primary = true
      AND has_club_role(primary_ec.club_id, current_user_id(), ARRAY['CLUB_ADMIN', 'CORE_MEMBER'])
  )
  OR
  -- Or, the user is a global admin
  EXISTS (SELECT 1 FROM users u WHERE u.id = current_user_id() AND u.global_role IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN'))
);

DROP POLICY IF EXISTS "Allow UPDATE on event_clubs" ON event_clubs;
CREATE POLICY "Allow UPDATE on event_clubs" ON event_clubs FOR UPDATE USING (
  has_club_role(club_id, current_user_id(), ARRAY['CLUB_ADMIN', 'CORE_MEMBER']) OR
  EXISTS (
    SELECT 1 FROM event_clubs primary_ec
    WHERE primary_ec.event_id = event_id 
      AND primary_ec.is_primary = true
      AND has_club_role(primary_ec.club_id, current_user_id(), ARRAY['CLUB_ADMIN', 'CORE_MEMBER'])
  ) OR
  EXISTS (SELECT 1 FROM users u WHERE u.id = current_user_id() AND u.global_role IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN'))
) WITH CHECK (
  has_club_role(club_id, current_user_id(), ARRAY['CLUB_ADMIN', 'CORE_MEMBER']) OR
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
  has_club_role(club_id, current_user_id(), ARRAY['CLUB_ADMIN', 'CORE_MEMBER']) OR
  EXISTS (
    SELECT 1 FROM event_clubs primary_ec
    WHERE primary_ec.event_id = event_id 
      AND primary_ec.is_primary = true
      AND has_club_role(primary_ec.club_id, current_user_id(), ARRAY['CLUB_ADMIN', 'CORE_MEMBER'])
  ) OR
  EXISTS (SELECT 1 FROM users u WHERE u.id = current_user_id() AND u.global_role IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN'))
);
