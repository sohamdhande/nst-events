-- SECURITY INVARIANT:
-- This function is SAFE ONLY because the returned qr_secret is meaningless to a caller
-- who cannot already produce a valid HMAC signature for it (a chicken-and-egg problem).
-- It must NEVER be exposed to any code path that returns its result directly to a client,
-- logs it, or uses it for any purpose other than immediate server-side HMAC verification.
-- Any future caller of this function must re-verify this invariant holds for their use case.
CREATE OR REPLACE FUNCTION public.get_session_qr_context(p_session_id uuid)
RETURNS TABLE (
  qr_secret text,
  open_at timestamptz,
  close_at timestamptz,
  event_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT s.qr_secret, s.open_at, s.close_at, s.event_id
  FROM attendance_sessions s
  WHERE s.id = p_session_id AND s.deleted_at IS NULL;
END;
$$;

-- Grant execution to nst_app
GRANT EXECUTE ON FUNCTION public.get_session_qr_context(uuid) TO nst_app;
