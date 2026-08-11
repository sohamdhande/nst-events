-- =====================================================================
-- Phase 15A: Global Role Database Immutability
-- Goal: Prevent untrusted application role from mutating users.global_role.
-- =====================================================================

CREATE OR REPLACE FUNCTION prevent_global_role_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If global_role is being modified
  IF NEW.global_role IS DISTINCT FROM OLD.global_role THEN
    -- Block ALL global_role modifications originating from the untrusted application DB role
    IF session_user = 'nst_app' THEN
      RAISE EXCEPTION 'Unauthorized: global_role is immutable to the application database role.';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_global_role_protection ON users;
CREATE TRIGGER enforce_global_role_protection
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION prevent_global_role_escalation();
