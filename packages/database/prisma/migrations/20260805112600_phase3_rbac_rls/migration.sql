-- 1. Setup least-privilege application role for RLS enforcement
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'nst_app') THEN
    CREATE ROLE nst_app WITH LOGIN;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO nst_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO nst_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO nst_app;

-- Ensure future tables get the same grants automatically
ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO nst_app;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT USAGE, SELECT ON SEQUENCES TO nst_app;


-- 2. Ensure current_user_id() exists (from 01-rls-architecture.md)
CREATE OR REPLACE FUNCTION current_user_id() RETURNS uuid AS $$
  SELECT nullif(current_setting('app.user_id', true), '')::uuid;
$$ LANGUAGE sql STABLE;

-- 3. Audit trigger function and trigger for club_memberships
CREATE OR REPLACE FUNCTION audit_club_membership_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, previous_state, ip_address, created_at)
    VALUES (current_user_id(), 'DELETE', 'club_membership', OLD.id, row_to_json(OLD)::jsonb, null, now());
    RETURN OLD;
  ELSIF (TG_OP = 'UPDATE') THEN
    INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, previous_state, new_state, ip_address, created_at)
    VALUES (current_user_id(), 'UPDATE', 'club_membership', NEW.id, row_to_json(OLD)::jsonb, row_to_json(NEW)::jsonb, null, now());
    RETURN NEW;
  ELSIF (TG_OP = 'INSERT') THEN
    INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, new_state, ip_address, created_at)
    VALUES (current_user_id(), 'INSERT', 'club_membership', NEW.id, row_to_json(NEW)::jsonb, null, now());
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS audit_club_memberships_trigger ON club_memberships;
CREATE TRIGGER audit_club_memberships_trigger
  AFTER INSERT OR UPDATE OR DELETE ON club_memberships
  FOR EACH ROW EXECUTE FUNCTION audit_club_membership_changes();

-- 4. Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE club_memberships ENABLE ROW LEVEL SECURITY;

-- 5. Policies for 'users'
DROP POLICY IF EXISTS "Allow authenticated users to SELECT users" ON users;
CREATE POLICY "Allow authenticated users to SELECT users" ON users
  FOR SELECT USING (current_user_id() IS NOT NULL);

DROP POLICY IF EXISTS "Allow users to UPDATE own profile" ON users;
CREATE POLICY "Allow users to UPDATE own profile" ON users
  FOR UPDATE USING (id = current_user_id()) WITH CHECK (id = current_user_id());

-- 6. Policies for 'clubs'
DROP POLICY IF EXISTS "Allow authenticated users to SELECT clubs" ON clubs;
CREATE POLICY "Allow authenticated users to SELECT clubs" ON clubs
  FOR SELECT USING (current_user_id() IS NOT NULL);

DROP POLICY IF EXISTS "Allow PLATFORM_ADMIN to UPDATE clubs" ON clubs;
CREATE POLICY "Allow PLATFORM_ADMIN to UPDATE clubs" ON clubs
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = current_user_id()
        AND u.global_role = 'PLATFORM_ADMIN'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = current_user_id()
        AND u.global_role = 'PLATFORM_ADMIN'
    )
  );

-- Helper functions to prevent infinite recursion in RLS policies for club_memberships
CREATE OR REPLACE FUNCTION is_active_club_member(p_club_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM club_memberships
    WHERE club_id = p_club_id
      AND user_id = p_user_id
      AND deleted_at IS NULL
  );
$$;

CREATE OR REPLACE FUNCTION has_club_role(p_club_id uuid, p_user_id uuid, p_roles text[])
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM club_memberships
    WHERE club_id = p_club_id
      AND user_id = p_user_id
      AND role::text = ANY(p_roles)
      AND deleted_at IS NULL
  );
$$;

-- 7. Policies for 'club_memberships'
DROP POLICY IF EXISTS "Allow authenticated users to SELECT club_memberships" ON club_memberships;
CREATE POLICY "Allow members and admins to SELECT club_memberships" ON club_memberships
  FOR SELECT
  USING (
    -- Global bypass for PLATFORM_ADMIN and FACULTY_ADMIN
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = current_user_id()
        AND u.global_role IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN')
    )
    OR
    -- Club-scoped check for any active member of the same club
    is_active_club_member(club_id, current_user_id())
  );

DROP POLICY IF EXISTS "Allow members INSERT for Admins and Faculty" ON club_memberships;
CREATE POLICY "Allow members INSERT for Admins and Faculty" ON club_memberships
  FOR INSERT
  WITH CHECK (
    -- Global bypass for PLATFORM_ADMIN and FACULTY_ADMIN
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = current_user_id()
        AND u.global_role IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN')
    )
    OR
    -- Club-scoped check for CLUB_ADMIN and FACULTY_MENTOR
    has_club_role(club_id, current_user_id(), ARRAY['CLUB_ADMIN', 'FACULTY_MENTOR'])
  );

DROP POLICY IF EXISTS "Allow members UPDATE for Admins and Faculty" ON club_memberships;
CREATE POLICY "Allow members UPDATE for Admins and Faculty" ON club_memberships
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = current_user_id()
        AND u.global_role IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN')
    )
    OR
    has_club_role(club_id, current_user_id(), ARRAY['CLUB_ADMIN', 'FACULTY_MENTOR'])
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = current_user_id()
        AND u.global_role IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN')
    )
    OR
    has_club_role(club_id, current_user_id(), ARRAY['CLUB_ADMIN', 'FACULTY_MENTOR'])
  );

DROP POLICY IF EXISTS "Allow members DELETE for Admins and Faculty" ON club_memberships;
CREATE POLICY "Allow members DELETE for Admins and Faculty" ON club_memberships
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = current_user_id()
        AND u.global_role IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN')
    )
    OR
    has_club_role(club_id, current_user_id(), ARRAY['CLUB_ADMIN', 'FACULTY_MENTOR'])
  );
