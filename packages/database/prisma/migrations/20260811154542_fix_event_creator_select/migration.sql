DROP POLICY IF EXISTS "Allow SELECT on events" ON events;
CREATE POLICY "Allow SELECT on events" ON events FOR SELECT USING (
  current_user_id() IS NOT NULL AND (
    (state = 'PUBLISHED' AND visibility = 'PUBLIC') OR
    created_by = current_user_id() OR
    (EXISTS (
      SELECT 1 FROM event_clubs ec 
      WHERE ec.event_id = id AND is_active_club_member(ec.club_id, current_user_id())
    )) OR
    (EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = current_user_id() AND u.global_role IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN')
    ))
  )
);
