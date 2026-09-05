-- Fix Attendance Eligibility for Primary Club Admin Own-Event Participation (Authoritative Backend Enforcement)

CREATE OR REPLACE FUNCTION public.check_attendance_eligibility(p_event_id uuid, p_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_reg_status TEXT;
  v_eligibility_scope_snapshot TEXT;
  v_academic_batch_id_snapshot UUID;
  v_event_audience TEXT;
  v_user_batch_id UUID;
  v_batch_match BOOLEAN;
BEGIN
  -- ── ENFORCE: Primary Club Admin cannot participate in their own event ──
  IF EXISTS (
    SELECT 1 FROM event_clubs ec
    JOIN club_memberships cm ON cm.club_id = ec.club_id
    WHERE ec.event_id = p_event_id 
      AND ec.is_primary = true 
      AND cm.user_id = p_user_id 
      AND cm.role = 'CLUB_ADMIN' 
      AND cm.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Primary Club Admin cannot participate in their own event' USING ERRCODE = 'U0004';
  END IF;

  -- ── Registration Check ──────────────────────────────────────────
  SELECT registration_status::text, eligibility_scope_snapshot::text, academic_batch_id_snapshot
  INTO v_reg_status, v_eligibility_scope_snapshot, v_academic_batch_id_snapshot
  FROM event_registrations
  WHERE event_id = p_event_id
    AND user_id = p_user_id
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_REGISTERED' USING ERRCODE = 'U0003';
  END IF;

  IF v_reg_status = 'WAITLISTED' THEN
    RAISE EXCEPTION 'WAITLISTED' USING ERRCODE = 'U0002';
  END IF;

  IF v_reg_status != 'REGISTERED' THEN
    -- Fail closed: CANCELLED or any future unknown status
    RAISE EXCEPTION 'REGISTRATION_NOT_ELIGIBLE' USING ERRCODE = 'U0004';
  END IF;

  -- ── Registration-Time Eligibility Snapshot Check ───────────────────
  IF v_eligibility_scope_snapshot IS NOT NULL THEN
    -- Snapshot exists, meaning eligibility was verified at registration time.
    -- We trust the snapshot entirely. No dynamic recomputation.
    RETURN;
  END IF;

  -- ── Fallback Academic Eligibility Check for Historical Registrations ──────────────────────────────────
  SELECT audience::text INTO v_event_audience
  FROM events
  WHERE id = p_event_id;

  IF v_event_audience = 'ALL_STUDENTS' THEN
    -- No batch restriction applies
    RETURN;
  END IF;

  -- Event audience = SPECIFIC_BATCHES: require matching batch
  SELECT batch_id INTO v_user_batch_id
  FROM user_academic_profiles
  WHERE user_id = p_user_id;

  IF NOT FOUND OR v_user_batch_id IS NULL THEN
    RAISE EXCEPTION 'ACADEMIC_PROFILE_MISSING' USING ERRCODE = 'U0012';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM event_audience_batches
    WHERE event_id = p_event_id
      AND batch_id = v_user_batch_id
  ) INTO v_batch_match;

  IF NOT v_batch_match THEN
    RAISE EXCEPTION 'ACADEMICALLY_INELIGIBLE' USING ERRCODE = 'U0013';
  END IF;

  -- All checks passed
  RETURN;
END;
$function$;
