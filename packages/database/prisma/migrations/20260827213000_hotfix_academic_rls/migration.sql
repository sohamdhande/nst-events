-- Hotfix: Allow all authenticated users to read user_academic_profiles so that team leaders can check invitee eligibility

DROP POLICY IF EXISTS "Allow users SELECT own user_academic_profiles" ON "user_academic_profiles";

CREATE POLICY "Allow users SELECT all user_academic_profiles" ON "user_academic_profiles"
FOR SELECT TO nst_app USING (current_user_id() IS NOT NULL);
