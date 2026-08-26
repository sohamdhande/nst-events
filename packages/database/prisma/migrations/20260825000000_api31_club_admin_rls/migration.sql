-- Allow CLUB_ADMIN to update their own club
CREATE POLICY "Allow CLUB_ADMIN to UPDATE clubs" ON clubs
  FOR UPDATE
  USING (
    has_club_role(id, (current_user_id())::uuid, ARRAY['CLUB_ADMIN'])
  )
  WITH CHECK (
    has_club_role(id, (current_user_id())::uuid, ARRAY['CLUB_ADMIN'])
  );
