-- Phase 26A Remediation: Fix BOLA in resolve_attendance_dispute
CREATE OR REPLACE FUNCTION public.resolve_attendance_dispute(p_dispute_id uuid, p_resolution text, p_review_notes text)
 RETURNS public.attendance_disputes
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_dispute public.attendance_disputes;
  v_actor_id UUID;
BEGIN
  v_actor_id := public.current_user_id();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;

  SELECT * INTO v_dispute FROM public.attendance_disputes WHERE id = p_dispute_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'DISPUTE_NOT_FOUND';
  END IF;

  IF v_dispute.status != 'PENDING' THEN
    RAISE EXCEPTION 'DISPUTE_ALREADY_RESOLVED';
  END IF;

  IF p_resolution NOT IN ('APPROVED', 'REJECTED') THEN
    RAISE EXCEPTION 'INVALID_RESOLUTION';
  END IF;

  -- BOLA FIX: Normal student cannot resolve their own dispute
  IF v_actor_id = v_dispute.user_id THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;

  -- BOLA FIX: Verify actor has administrative rights for this event
  IF NOT EXISTS (
    SELECT 1 FROM public.users u WHERE u.id = v_actor_id AND u.global_role IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN')
  ) AND NOT EXISTS (
    SELECT 1 FROM public.event_clubs ec
    JOIN public.club_memberships cm ON ec.club_id = cm.club_id
    WHERE ec.event_id = v_dispute.event_id
      AND cm.user_id = v_actor_id
      AND cm.role IN ('CLUB_ADMIN', 'FACULTY_MENTOR')
      AND cm.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;

  UPDATE public.attendance_disputes
  SET status = p_resolution::"DisputeStatus",
      reviewed_by = v_actor_id,
      reviewed_at = now(),
      review_notes = p_review_notes
  WHERE id = p_dispute_id
  RETURNING * INTO v_dispute;

  IF p_resolution = 'APPROVED' THEN
    INSERT INTO public.attendance_records (
      session_id, user_id, marked_by, marked_at, method, status, audit_metadata
    ) VALUES (
      v_dispute.session_id, v_dispute.user_id, v_actor_id, now(), 'SYSTEM', 'EXCUSED', '{"dispute_resolved": true}'::jsonb
    )
    ON CONFLICT (session_id, user_id) DO UPDATE
    SET status = 'EXCUSED',
        marked_by = v_actor_id,
        marked_at = now(),
        audit_metadata = attendance_records.audit_metadata || '{"dispute_resolved": true}'::jsonb;
  END IF;

  RETURN v_dispute;
END;
$function$;
