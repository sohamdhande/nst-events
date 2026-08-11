-- 1. Create a SECURITY DEFINER function to get the current user's global role
CREATE OR REPLACE FUNCTION current_user_global_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT global_role::text FROM users WHERE id = current_user_id();
$$;

-- Ensure standard privileges on the function
REVOKE ALL ON FUNCTION current_user_global_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION current_user_global_role() TO PUBLIC;

-- 2. Drop the existing overly-permissive policy
DROP POLICY IF EXISTS "Allow authenticated users to SELECT users" ON users;

-- 3. Create a SECURITY DEFINER function for the complex EXISTS check
-- This breaks the infinite recursion cycle between users, event_registrations, and attendance_records policies
CREATE OR REPLACE FUNCTION can_see_user_as_organizer(target_user_id uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM event_clubs ec 
    JOIN club_memberships cm ON ec.club_id = cm.club_id 
    WHERE cm.user_id = current_user_id() 
    AND cm.role IN ('CLUB_ADMIN', 'CORE_MEMBER', 'FACULTY_MENTOR')
    AND (
        EXISTS (
            SELECT 1 FROM event_registrations er
            WHERE er.event_id = ec.event_id
            AND er.user_id = target_user_id
        )
        OR EXISTS (
            SELECT 1 FROM attendance_sessions asess
            JOIN attendance_records ar ON ar.session_id = asess.id
            WHERE asess.event_id = ec.event_id
            AND ar.user_id = target_user_id
        )
    )
  );
END;
$$;

-- Ensure standard privileges on the function
REVOKE ALL ON FUNCTION can_see_user_as_organizer(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION can_see_user_as_organizer(uuid) TO PUBLIC;

-- 4. Create the new scoped RLS policy for the users table
CREATE POLICY "Allow scoped SELECT on users" ON users
FOR SELECT USING (
  -- 1. Own profile
  id = current_user_id()
  
  -- 2. Global admins
  OR current_user_global_role() IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN')
  
  -- 3. Club Admins/Mentors for their attendees (bypassing RLS cycle via SECURITY DEFINER)
  OR can_see_user_as_organizer(id)
);

-- 4. Create the public_profiles view
CREATE OR REPLACE VIEW public_profiles AS
SELECT 
    id,
    full_name,
    avatar_url,
    global_role,
    created_at,
    updated_at,
    deleted_at
FROM users;

GRANT SELECT ON public_profiles TO nst_app;
