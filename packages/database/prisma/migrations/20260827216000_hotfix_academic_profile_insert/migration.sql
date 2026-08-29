-- Hotfix: Allow users to insert their own academic profile (needed during login inference)

CREATE POLICY "Allow users INSERT own user_academic_profiles" ON "user_academic_profiles"
FOR INSERT TO nst_app WITH CHECK (user_id = current_user_id());
