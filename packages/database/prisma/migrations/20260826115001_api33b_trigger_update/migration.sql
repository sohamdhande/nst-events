-- Update trigger to allow PLATFORM_ADMIN to mutate global role
CREATE OR REPLACE FUNCTION prevent_global_role_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.global_role IS DISTINCT FROM OLD.global_role THEN
    IF session_user = 'nst_app' THEN
      IF current_setting('app.user_id', true) IS NULL OR current_setting('app.user_id', true) = '' THEN
        RAISE EXCEPTION 'Unauthorized: global_role mutation requires app.user_id context';
      END IF;
      
      IF (SELECT global_role FROM users WHERE id = current_setting('app.user_id', true)::uuid) != 'PLATFORM_ADMIN' THEN
        RAISE EXCEPTION 'Unauthorized: only PLATFORM_ADMIN can mutate global roles.';
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;
