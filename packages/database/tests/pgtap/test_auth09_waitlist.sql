BEGIN;
CREATE OR REPLACE FUNCTION cancel_registration(p_event_id UUID, p_user_id UUID)
RETURNS UUID[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_caller_id UUID := current_user_id();
  v_reg event_registrations;
  v_promoted UUID[] := ARRAY[]::UUID[];
  v_new_count INT;
BEGIN
  IF v_caller_id != p_user_id AND NOT EXISTS (
    SELECT 1 FROM users WHERE id = v_caller_id AND global_role IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN')
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  PERFORM 1 FROM events WHERE id = p_event_id FOR UPDATE;

  SELECT * INTO v_reg FROM event_registrations 
  WHERE event_id = p_event_id AND user_id = p_user_id AND deleted_at IS NULL;

  IF NOT FOUND THEN RAISE EXCEPTION 'Registration not found'; END IF;

  UPDATE event_registrations 
  SET deleted_at = now(), registration_status = 'CANCELLED' 
  WHERE id = v_reg.id;

  IF v_reg.registration_status = 'REGISTERED' THEN
    UPDATE events SET registration_count = registration_count - 1 WHERE id = p_event_id;
    v_promoted := process_waitlist(p_event_id);
    SELECT registration_count INTO v_new_count FROM events WHERE id = p_event_id;
    PERFORM emit_event_live_update(p_event_id, 'registration_count', jsonb_build_object('count', v_new_count));
  END IF;

  RETURN v_promoted;
END;
$$;
-- 1. Modify process_waitlist to handle both INDIVIDUAL and TEAM registrations natively.
CREATE OR REPLACE FUNCTION public.process_waitlist(p_event_id uuid)
 RETURNS uuid[]
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_promoted_ids UUID[] := ARRAY[]::UUID[];
  v_team RECORD;
  v_individual RECORD;
  v_member_ids UUID[];
  v_capacity_left INT;
  v_event events;
BEGIN
  -- Re-read event capacity to ensure we don't violate bounds
  SELECT * INTO v_event FROM events WHERE id = p_event_id FOR UPDATE;

  IF v_event.registration_type = 'INDIVIDUAL' THEN
    LOOP
      -- Calculate capacity left
      IF v_event.max_capacity IS NULL THEN
        v_capacity_left := 999999;
      ELSE
        v_capacity_left := v_event.max_capacity - v_event.registration_count;
      END IF;

      IF v_capacity_left <= 0 THEN
        EXIT;
      END IF;

      -- Find the oldest waitlisted individual
      SELECT er.id, er.user_id
      INTO v_individual
      FROM event_registrations er
      WHERE er.event_id = p_event_id 
        AND er.registration_status = 'WAITLISTED'
        AND er.deleted_at IS NULL
        AND er.team_id IS NULL
      ORDER BY er.registered_at ASC, er.id ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED;

      IF NOT FOUND THEN
        EXIT;
      END IF;

      -- Promote the individual
      UPDATE event_registrations 
      SET 
        registration_status = 'REGISTERED', 
        eligibility_scope_snapshot = v_event.audience, 
        academic_batch_id_snapshot = CASE WHEN v_event.audience = 'SPECIFIC_BATCHES' THEN (SELECT batch_id FROM user_academic_profiles WHERE user_id = event_registrations.user_id) ELSE NULL END 
      WHERE id = v_individual.id;
      
      v_promoted_ids := array_append(v_promoted_ids, v_individual.user_id);
      
      -- Update event registration count locally
      v_event.registration_count := v_event.registration_count + 1;
      UPDATE events SET registration_count = v_event.registration_count WHERE id = p_event_id;
    END LOOP;

  ELSIF v_event.registration_type = 'TEAM' THEN
    LOOP
      -- Calculate capacity left
      IF v_event.max_capacity IS NULL THEN
        v_capacity_left := 999999;
      ELSE
        v_capacity_left := v_event.max_capacity - v_event.registration_count;
      END IF;

      IF v_capacity_left <= 0 THEN
        EXIT;
      END IF;

      -- Find the oldest waitlisted team
      SELECT t.id, (
          SELECT count(*) FROM event_registrations er 
          WHERE er.team_id = t.id AND er.deleted_at IS NULL
      ) as member_count
      INTO v_team
      FROM teams t
      WHERE t.event_id = p_event_id 
        AND t.status = 'WAITLISTED'
        AND t.deleted_at IS NULL
      ORDER BY (
          SELECT min(er.registered_at) FROM event_registrations er 
          WHERE er.team_id = t.id AND er.deleted_at IS NULL
      ) ASC, t.id ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED;

      IF NOT FOUND THEN
        EXIT;
      END IF;

      -- Does this entire team fit?
      IF v_team.member_count <= v_capacity_left THEN
        -- Promote the team
        UPDATE teams SET status = 'REGISTERED' WHERE id = v_team.id;
        
        UPDATE event_registrations 
        SET 
          registration_status = 'REGISTERED', 
          eligibility_scope_snapshot = v_event.audience, 
          academic_batch_id_snapshot = CASE WHEN v_event.audience = 'SPECIFIC_BATCHES' THEN (SELECT batch_id FROM user_academic_profiles WHERE user_id = event_registrations.user_id) ELSE NULL END 
        WHERE team_id = v_team.id AND deleted_at IS NULL;
        
        -- Add team members to promoted list
        SELECT array_agg(user_id) INTO v_member_ids
        FROM event_registrations 
        WHERE team_id = v_team.id AND deleted_at IS NULL;
        
        v_promoted_ids := array_cat(v_promoted_ids, v_member_ids);
        
        -- Update event registration count locally
        v_event.registration_count := v_event.registration_count + v_team.member_count;
        UPDATE events SET registration_count = v_event.registration_count WHERE id = p_event_id;
      ELSE
        -- Team does not fit, we stop promoting (no partial, no leapfrogging)
        EXIT;
      END IF;
    END LOOP;
  END IF;
  
  RETURN v_promoted_ids;
END;
$function$;



BEGIN;
CREATE OR REPLACE FUNCTION cancel_registration(p_event_id UUID, p_user_id UUID)
RETURNS UUID[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_caller_id UUID := current_user_id();
  v_reg event_registrations;
  v_promoted UUID[] := ARRAY[]::UUID[];
  v_new_count INT;
BEGIN
  IF v_caller_id != p_user_id AND NOT EXISTS (
    SELECT 1 FROM users WHERE id = v_caller_id AND global_role IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN')
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  PERFORM 1 FROM events WHERE id = p_event_id FOR UPDATE;

  SELECT * INTO v_reg FROM event_registrations 
  WHERE event_id = p_event_id AND user_id = p_user_id AND deleted_at IS NULL;

  IF NOT FOUND THEN RAISE EXCEPTION 'Registration not found'; END IF;

  UPDATE event_registrations 
  SET deleted_at = now(), registration_status = 'CANCELLED' 
  WHERE id = v_reg.id;

  IF v_reg.registration_status = 'REGISTERED' THEN
    UPDATE events SET registration_count = registration_count - 1 WHERE id = p_event_id;
    v_promoted := process_waitlist(p_event_id);
    SELECT registration_count INTO v_new_count FROM events WHERE id = p_event_id;
    PERFORM emit_event_live_update(p_event_id, 'registration_count', jsonb_build_object('count', v_new_count));
  END IF;

  RETURN v_promoted;
END;
$$;

SELECT plan(14);

-- Clean up
DELETE FROM team_invitations;
DELETE FROM event_audience_batches;
DELETE FROM club_memberships;

DELETE FROM event_registrations;
DELETE FROM teams;
DELETE FROM events;
DELETE FROM public_profiles;
DELETE FROM user_academic_profiles;
DELETE FROM users;
DELETE FROM academic_batches;
DELETE FROM academic_programs;

-- Setup Users
INSERT INTO academic_programs (id, name, code) VALUES ('00000000-0000-0000-0000-000000000000', 'BTech', 'BTECH');
INSERT INTO academic_batches (id, program_id, admission_year, graduation_year) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000000', 2022, 2026), ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '00000000-0000-0000-0000-000000000000', 2023, 2027), ('cccccccc-cccc-cccc-cccc-cccccccccccc', '00000000-0000-0000-0000-000000000000', 2024, 2028);

INSERT INTO users (id, email, global_role, google_sub, full_name) VALUES 
('11111111-1111-1111-1111-111111111111', 'a@test.com', 'STUDENT', 'sub1', 'A'),
('22222222-2222-2222-2222-222222222222', 'b@test.com', 'STUDENT', 'sub2', 'B'),
('33333333-3333-3333-3333-333333333333', 'c@test.com', 'STUDENT', 'sub3', 'C'), ('44444444-4444-4444-4444-444444444444', 'd@test.com', 'STUDENT', 'sub4', 'D');

INSERT INTO user_academic_profiles (id, user_id, batch_id, assignment_source) VALUES
('11111111-1111-1111-1111-111111111112', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'INSTITUTIONAL_EMAIL_INFERENCE'),
('22222222-2222-2222-2222-222222222223', '22222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'INSTITUTIONAL_EMAIL_INFERENCE'),
('33333333-3333-3333-3333-333333333334', '33333333-3333-3333-3333-333333333333', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'INSTITUTIONAL_EMAIL_INFERENCE'), ('44444444-4444-4444-4444-444444444445', '44444444-4444-4444-4444-444444444444', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'INSTITUTIONAL_EMAIL_INFERENCE');

-- Test 1: Individual Waitlist FIFO Promotion and Snapshot Capture
INSERT INTO events (id, title, start_time, end_time, event_type, state, registration_type, max_capacity, registration_count, created_by, audience)
VALUES ('00000000-0000-0000-0000-000000000001', 'Test Event', now(), now() + interval '1 hour', 'WORKSHOP', 'PUBLISHED', 'INDIVIDUAL', 1, 1, '11111111-1111-1111-1111-111111111111', 'SPECIFIC_BATCHES');

-- User 1 is registered
INSERT INTO event_registrations (id, event_id, user_id, registration_status, registered_at, eligibility_scope_snapshot, academic_batch_id_snapshot)
VALUES ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'REGISTERED', now() - interval '3 hours', 'SPECIFIC_BATCHES', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');

-- User 2 is waitlisted first
INSERT INTO event_registrations (id, event_id, user_id, registration_status, registered_at)
VALUES ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'WAITLISTED', now() - interval '2 hours');

-- User 3 is waitlisted second
INSERT INTO event_registrations (id, event_id, user_id, registration_status, registered_at)
VALUES ('30000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 'WAITLISTED', now() - interval '1 hour');

-- Initial state checks
SELECT results_eq(
    $$ SELECT registration_status::text FROM event_registrations WHERE user_id = '22222222-2222-2222-2222-222222222222' $$,
    $$ VALUES ('WAITLISTED') $$,
    'User 2 starts on waitlist'
);

SELECT results_eq(
    $$ SELECT eligibility_scope_snapshot IS NULL FROM event_registrations WHERE user_id = '22222222-2222-2222-2222-222222222222' $$,
    $$ VALUES (true) $$,
    'User 2 has no snapshot while waitlisted'
);

-- Cancel user 1, should promote user 2
SET LOCAL app.user_id = '11111111-1111-1111-1111-111111111111';
SELECT cancel_registration('00000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111');

SELECT results_eq(
    $$ SELECT registration_status::text FROM event_registrations WHERE user_id = '22222222-2222-2222-2222-222222222222' $$,
    $$ VALUES ('REGISTERED') $$,
    'User 2 promoted to registered'
);

SELECT results_eq(
    $$ SELECT eligibility_scope_snapshot::text FROM event_registrations WHERE user_id = '22222222-2222-2222-2222-222222222222' $$,
    $$ VALUES ('SPECIFIC_BATCHES') $$,
    'User 2 scope snapshot captured'
);

SELECT results_eq(
    $$ SELECT academic_batch_id_snapshot::text FROM event_registrations WHERE user_id = '22222222-2222-2222-2222-222222222222' $$,
    $$ VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb') $$,
    'User 2 batch snapshot captured correctly'
);

SELECT results_eq(
    $$ SELECT registration_status::text FROM event_registrations WHERE user_id = '33333333-3333-3333-3333-333333333333' $$,
    $$ VALUES ('WAITLISTED') $$,
    'User 3 remains waitlisted'
);

-- Idempotency check
SELECT process_waitlist('00000000-0000-0000-0000-000000000001');
SELECT results_eq(
    $$ SELECT registration_status::text FROM event_registrations WHERE user_id = '33333333-3333-3333-3333-333333333333' $$,
    $$ VALUES ('WAITLISTED') $$,
    'Repeated process_waitlist with no capacity does nothing'
);

-- Test 2: Team Waitlist Regression
INSERT INTO events (id, title, start_time, end_time, event_type, state, registration_type, max_capacity, registration_count, created_by, audience)
VALUES ('00000000-0000-0000-0000-000000000002', 'Test Team Event', now(), now() + interval '1 hour', 'WORKSHOP', 'PUBLISHED', 'TEAM', 1, 1, '11111111-1111-1111-1111-111111111111', 'ALL_STUDENTS');

-- Registered team (size 1)
INSERT INTO teams (id, event_id, name, leader_id, status) VALUES ('11111111-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000002', 'Team 1', '11111111-1111-1111-1111-111111111111', 'REGISTERED');
INSERT INTO event_registrations (id, event_id, team_id, user_id, registration_status, registered_at)
VALUES ('40000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'REGISTERED', now() - interval '3 hours');

-- Waitlisted team (size 1)
INSERT INTO teams (id, event_id, name, leader_id, status) VALUES ('22222222-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000002', 'Team 2', '22222222-2222-2222-2222-222222222222', 'WAITLISTED');
INSERT INTO event_registrations (id, event_id, team_id, user_id, registration_status, registered_at)
VALUES ('50000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000002', '22222222-0000-0000-0000-000000000000', '22222222-2222-2222-2222-222222222222', 'WAITLISTED', now() - interval '2 hours');

-- Waitlisted team (size 2, requires 2 capacity to promote)
INSERT INTO teams (id, event_id, name, leader_id, status) VALUES ('33333333-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000002', 'Team 3', '33333333-3333-3333-3333-333333333333', 'WAITLISTED');
INSERT INTO event_registrations (id, event_id, team_id, user_id, registration_status, registered_at)
VALUES 
('60000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000002', '33333333-0000-0000-0000-000000000000', '33333333-3333-3333-3333-333333333333', 'WAITLISTED', now() - interval '1 hour'),
('70000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000002', '33333333-0000-0000-0000-000000000000', '44444444-4444-4444-4444-444444444444', 'WAITLISTED', now() - interval '1 hour');

SELECT results_eq(
    $$ SELECT status::text FROM teams WHERE id = '22222222-0000-0000-0000-000000000000' $$,
    $$ VALUES ('WAITLISTED') $$,
    'Team 2 starts waitlisted'
);

-- Cancel team 1, should promote team 2
SET LOCAL app.user_id = '11111111-1111-1111-1111-111111111111';
SELECT cancel_team('00000000-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000000');

SELECT results_eq(
    $$ SELECT status::text FROM teams WHERE id = '22222222-0000-0000-0000-000000000000' $$,
    $$ VALUES ('REGISTERED') $$,
    'Team 2 promoted'
);

SELECT results_eq(
    $$ SELECT registration_status::text FROM event_registrations WHERE team_id = '22222222-0000-0000-0000-000000000000' $$,
    $$ VALUES ('REGISTERED') $$,
    'Team 2 members promoted'
);

SELECT results_eq(
    $$ SELECT status::text FROM teams WHERE id = '33333333-0000-0000-0000-000000000000' $$,
    $$ VALUES ('WAITLISTED') $$,
    'Team 3 skipped (needs 2 capacity)'
);

-- Security Definer checks
SELECT is(
    (SELECT prosecdef FROM pg_proc WHERE proname = 'process_waitlist'),
    true,
    'process_waitlist is SECURITY DEFINER'
);


-- Cancellation skipping test
INSERT INTO events (id, title, start_time, end_time, event_type, state, registration_type, max_capacity, registration_count, created_by, audience)
VALUES ('00000000-0000-0000-0000-000000000003', 'Test Event 3', now(), now() + interval '1 hour', 'WORKSHOP', 'PUBLISHED', 'INDIVIDUAL', 1, 1, '11111111-1111-1111-1111-111111111111', 'ALL_STUDENTS');

INSERT INTO event_registrations (id, event_id, user_id, registration_status, registered_at)
VALUES ('80000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'REGISTERED', now() - interval '4 hours');

-- User 2 waitlisted then cancelled
INSERT INTO event_registrations (id, event_id, user_id, registration_status, registered_at, deleted_at)
VALUES ('90000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000003', '22222222-2222-2222-2222-222222222222', 'CANCELLED', now() - interval '3 hours', now());

-- User 3 waitlisted
INSERT INTO event_registrations (id, event_id, user_id, registration_status, registered_at)
VALUES ('a0000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000003', '33333333-3333-3333-3333-333333333333', 'WAITLISTED', now() - interval '2 hours');

SET LOCAL app.user_id = '11111111-1111-1111-1111-111111111111';
SELECT cancel_registration('00000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111');

SELECT results_eq(
    $$ SELECT registration_status::text FROM event_registrations WHERE user_id = '33333333-3333-3333-3333-333333333333' AND event_id = '00000000-0000-0000-0000-000000000003' $$,
    $$ VALUES ('REGISTERED') $$,
    'User 3 promoted (User 2 was skipped because they cancelled)'
);

SELECT results_eq(
    $$ SELECT registration_status::text FROM event_registrations WHERE user_id = '22222222-2222-2222-2222-222222222222' AND event_id = '00000000-0000-0000-0000-000000000003' $$,
    $$ VALUES ('CANCELLED') $$,
    'User 2 remained cancelled'
);


SELECT * FROM finish();

ROLLBACK;
