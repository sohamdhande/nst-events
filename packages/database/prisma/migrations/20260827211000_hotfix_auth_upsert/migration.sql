CREATE OR REPLACE FUNCTION public.upsert_oauth_user(
  p_google_sub TEXT,
  p_email TEXT,
  p_full_name TEXT
)
RETURNS SETOF users
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $$
DECLARE
  v_role "GlobalRole" := 'STUDENT'::"GlobalRole";
  v_user users%ROWTYPE;
BEGIN
  IF p_email LIKE '%@newtonschool.co' THEN
    v_role := 'FACULTY_MENTOR'::"GlobalRole";
  END IF;

  -- First, try to find an existing user by email
  SELECT * INTO v_user FROM users WHERE email = p_email AND deleted_at IS NULL;

  IF FOUND THEN
    -- If they exist, update their google_sub and name if they differ
    IF v_user.google_sub IS DISTINCT FROM p_google_sub OR v_user.full_name IS DISTINCT FROM p_full_name THEN
      UPDATE users
      SET google_sub = p_google_sub, full_name = p_full_name, updated_at = NOW()
      WHERE id = v_user.id
      RETURNING * INTO v_user;
    END IF;
    RETURN NEXT v_user;
    RETURN;
  END IF;

  -- Otherwise, try to insert new user
  RETURN QUERY
  INSERT INTO users (id, google_sub, email, full_name, global_role)
  VALUES (gen_random_uuid(), p_google_sub, p_email, p_full_name, v_role)
  ON CONFLICT (google_sub) DO UPDATE
  SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    updated_at = NOW()
  WHERE users.deleted_at IS NULL
  RETURNING *;
END;
$$;
