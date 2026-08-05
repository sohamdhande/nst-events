-- 1. Fix the users SELECT policy to avoid tautology
DROP POLICY IF EXISTS "Allow authenticated users to SELECT users" ON users;
CREATE POLICY "Allow authenticated users to SELECT users" ON users
  FOR SELECT
  USING (current_user_id() IS NOT NULL);

-- 2. Drop the dangerous ad-hoc INSERT/UPDATE bypass policies
DROP POLICY IF EXISTS "Allow Express backend to INSERT users" ON users;
DROP POLICY IF EXISTS "Allow Express backend to UPDATE users" ON users;
DROP POLICY IF EXISTS "Allow Express backend to INSERT users during OAuth" ON users;
DROP POLICY IF EXISTS "Allow Express backend to UPDATE users during OAuth" ON users;

-- 3. Create a SECURITY DEFINER function to securely handle OAuth user upserts
CREATE OR REPLACE FUNCTION upsert_oauth_user(
  p_google_sub TEXT,
  p_email TEXT,
  p_full_name TEXT
)
RETURNS SETOF users
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  INSERT INTO users (id, google_sub, email, full_name, global_role)
  VALUES (gen_random_uuid(), p_google_sub, p_email, p_full_name, 'STUDENT'::"GlobalRole")
  ON CONFLICT (google_sub) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    updated_at = now()
  WHERE users.deleted_at IS NULL
  RETURNING *;
END;
$$;
REVOKE EXECUTE ON FUNCTION upsert_oauth_user(TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION upsert_oauth_user(TEXT, TEXT, TEXT) TO nst_app;
