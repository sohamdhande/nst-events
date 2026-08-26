CREATE POLICY "Allow global admins to INSERT users" ON users
FOR INSERT WITH CHECK (current_user_global_role() IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN'));
