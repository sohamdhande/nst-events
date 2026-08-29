-- Add INSERT policy for clubs
DROP POLICY IF EXISTS "Allow PLATFORM_ADMIN to INSERT clubs" ON clubs;
CREATE POLICY "Allow PLATFORM_ADMIN to INSERT clubs" ON clubs
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = current_user_id()
        AND u.global_role = 'PLATFORM_ADMIN'
    )
  );
