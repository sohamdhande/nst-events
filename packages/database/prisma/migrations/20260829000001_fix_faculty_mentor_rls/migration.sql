-- Drop existing over-permissive policies
DROP POLICY IF EXISTS "Allow members INSERT for Admins and Faculty" ON club_memberships;
DROP POLICY IF EXISTS "Allow members UPDATE for Admins and Faculty" ON club_memberships;
DROP POLICY IF EXISTS "Allow members DELETE for Admins and Faculty" ON club_memberships;

-- Recreate INSERT policy without FACULTY_MENTOR
CREATE POLICY "Allow members INSERT for Admins" ON club_memberships
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users u 
            WHERE u.id = current_user_id() AND u.global_role = 'PLATFORM_ADMIN'
        )
        OR 
        has_club_role(club_id, current_user_id(), ARRAY['CLUB_ADMIN'])
    );

-- Recreate UPDATE policy without FACULTY_MENTOR
CREATE POLICY "Allow members UPDATE for Admins" ON club_memberships
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM users u 
            WHERE u.id = current_user_id() AND u.global_role = 'PLATFORM_ADMIN'
        )
        OR 
        has_club_role(club_id, current_user_id(), ARRAY['CLUB_ADMIN'])
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users u 
            WHERE u.id = current_user_id() AND u.global_role = 'PLATFORM_ADMIN'
        )
        OR 
        has_club_role(club_id, current_user_id(), ARRAY['CLUB_ADMIN'])
    );

-- Recreate DELETE policy without FACULTY_MENTOR
CREATE POLICY "Allow members DELETE for Admins" ON club_memberships
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM users u 
            WHERE u.id = current_user_id() AND u.global_role = 'PLATFORM_ADMIN'
        )
        OR 
        has_club_role(club_id, current_user_id(), ARRAY['CLUB_ADMIN'])
    );
