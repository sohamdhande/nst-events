                                                       pg_get_functiondef                                                       
--------------------------------------------------------------------------------------------------------------------------------
 CREATE OR REPLACE FUNCTION public.manual_mark_attendance(p_session_id uuid, p_user_id uuid)                                   +
  RETURNS attendance_records                                                                                                   +
  LANGUAGE plpgsql                                                                                                             +
  SECURITY DEFINER                                                                                                             +
  SET search_path TO 'public'                                                                                                  +
 AS $function$                                                                                                                 +
 DECLARE                                                                                                                       +
   v_admin_id UUID;                                                                                                            +
   v_is_platform_admin BOOLEAN;                                                                                                +
   v_event_id UUID;                                                                                                            +
   v_event_state text;                                                                                                         +
   v_new_record attendance_records;                                                                                            +
   v_existing_record attendance_records;                                                                                       +
 BEGIN                                                                                                                         +
   v_admin_id := current_user_id();                                                                                            +
   IF v_admin_id IS NULL THEN                                                                                                  +
     RAISE EXCEPTION 'UNAUTHORIZED';                                                                                           +
   END IF;                                                                                                                     +
                                                                                                                               +
   SELECT EXISTS (                                                                                                             +
     SELECT 1 FROM users WHERE id = v_admin_id AND global_role = 'PLATFORM_ADMIN'                                              +
   ) INTO v_is_platform_admin;                                                                                                 +
                                                                                                                               +
   IF NOT v_is_platform_admin THEN                                                                                             +
     RAISE EXCEPTION 'UNAUTHORIZED';                                                                                           +
   END IF;                                                                                                                     +
                                                                                                                               +
   SELECT e.id, e.state                                                                                                        +
   INTO v_event_id, v_event_state                                                                                              +
   FROM attendance_sessions s                                                                                                  +
   JOIN events e ON s.event_id = e.id                                                                                          +
   WHERE s.id = p_session_id AND s.deleted_at IS NULL AND e.deleted_at IS NULL;                                                +
                                                                                                                               +
   IF NOT FOUND THEN                                                                                                           +
     RAISE EXCEPTION 'SESSION_CLOSED';                                                                                         +
   END IF;                                                                                                                     +
                                                                                                                               +
   IF v_event_state != 'PUBLISHED' THEN                                                                                        +
     RAISE EXCEPTION 'EVENT_LOCKED';                                                                                           +
   END IF;                                                                                                                     +
                                                                                                                               +
   -- ── SHARED ELIGIBILITY PRIMITIVE ────────────────────────────────                                                         +
   PERFORM check_attendance_eligibility(v_event_id, p_user_id);                                                                +
                                                                                                                               +
   INSERT INTO attendance_records (                                                                                            +
     id, session_id, user_id, marked_by, marked_at, method, status, audit_metadata                                             +
   ) VALUES (                                                                                                                  +
     gen_random_uuid(), p_session_id, p_user_id, v_admin_id, now(), 'MANUAL', 'PRESENT', jsonb_build_object('method', 'MANUAL')+
   )                                                                                                                           +
   ON CONFLICT (session_id, user_id) DO NOTHING                                                                                +
   RETURNING * INTO v_new_record;                                                                                              +
                                                                                                                               +
   IF FOUND THEN                                                                                                               +
     PERFORM set_config('app.attendance_is_new', 'true', true);                                                                +
                                                                                                                               +
     INSERT INTO leaderboard_scores (                                                                                          +
       id, user_id, club_id, points, reason, source_id, created_at                                                             +
     ) VALUES (                                                                                                                +
       gen_random_uuid(), p_user_id, NULL, 5, 'ATTENDANCE', v_new_record.id, now()                                             +
     );                                                                                                                        +
                                                                                                                               +
     INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, new_state, created_at)                                  +
     VALUES (                                                                                                                  +
       v_admin_id, 'ATTENDANCE_MANUAL_MARK', 'attendance_records', v_new_record.id, row_to_json(v_new_record)::jsonb, now()    +
     );                                                                                                                        +
                                                                                                                               +
     RETURN v_new_record;                                                                                                      +
   ELSE                                                                                                                        +
     PERFORM set_config('app.attendance_is_new', 'false', true);                                                               +
                                                                                                                               +
     SELECT * INTO v_existing_record                                                                                           +
     FROM attendance_records                                                                                                   +
     WHERE session_id = p_session_id AND user_id = p_user_id;                                                                  +
                                                                                                                               +
     RETURN v_existing_record;                                                                                                 +
   END IF;                                                                                                                     +
 END;                                                                                                                          +
 $function$                                                                                                                    +
 
(1 row)

