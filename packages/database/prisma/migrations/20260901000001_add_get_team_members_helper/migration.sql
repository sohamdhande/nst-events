-- Add helper function to fetch team members bypassing RLS for notifications
CREATE OR REPLACE FUNCTION get_team_members(p_team_id UUID)
RETURNS UUID[]
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(user_id), ARRAY[]::UUID[]) FROM event_registrations WHERE team_id = p_team_id AND deleted_at IS NULL;
$$;
