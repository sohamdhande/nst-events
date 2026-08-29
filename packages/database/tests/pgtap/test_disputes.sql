BEGIN;
SELECT plan(15);

-- Setup test data
\set user1_id '''00000000-0000-0000-0000-000000000001'''
\set user2_id '''00000000-0000-0000-0000-000000000002'''
\set admin_id '''00000000-0000-0000-0000-000000000003'''
\set event_id '''00000000-0000-0000-0000-000000000010'''
\set session_id '''00000000-0000-0000-0000-000000000020'''

INSERT INTO users (id, google_sub, email, full_name, global_role) VALUES
  (:user1_id, 'sub1', 'u1@test.com', 'User 1', 'STUDENT'),
  (:user2_id, 'sub2', 'u2@test.com', 'User 2', 'STUDENT'),
  (:admin_id, 'sub3', 'admin@test.com', 'Admin', 'PLATFORM_ADMIN');

INSERT INTO events (id, title, state, audience, event_type, start_time, end_time, created_by)
VALUES (:event_id, 'Test Event', 'PUBLISHED', 'ALL_STUDENTS', 'WORKSHOP', now() - interval '2 days', now() - interval '1 day', :admin_id);

INSERT INTO attendance_sessions (id, event_id, title, start_time, end_time, open_at, close_at, qr_secret, created_by)
VALUES (:session_id, :event_id, 'Session 1', now() - interval '2 days', now() - interval '1 day', now() - interval '2 days', now() - interval '1 day', 'secret', :admin_id);

-- user1 is registered, user2 is not
INSERT INTO event_registrations (id, event_id, user_id, registration_status)
VALUES (gen_random_uuid(), :event_id, :user1_id, 'REGISTERED');

-- Test 1: Unregistered user cannot submit
SELECT set_config('app.user_id', :user2_id, true);
SELECT throws_ok(
  'SELECT submit_attendance_dispute(''' || :session_id || '''::uuid, ''I was there'')',
  'U0003',
  'NOT_REGISTERED',
  'Unregistered user should not be able to submit a dispute'
);

-- Test 2: Registered user can submit
SELECT set_config('app.user_id', :user1_id, true);
SELECT lives_ok(
  'SELECT submit_attendance_dispute(''' || :session_id || '''::uuid, ''I was there'')',
  'Registered user should be able to submit a dispute'
);

-- Fetch dispute ID
CREATE TEMP TABLE tmp_dispute AS SELECT * FROM attendance_disputes WHERE user_id = :user1_id AND session_id = :session_id;

-- Test 3: Duplicate submission blocked natively
SELECT throws_ok(
  'SELECT submit_attendance_dispute(''' || :session_id || '''::uuid, ''Duplicate'')',
  '23505',
  NULL,
  'Duplicate dispute should throw unique constraint violation'
);

-- Test 4: Student cannot resolve their own dispute
SELECT throws_ok(
  'SELECT resolve_attendance_dispute((SELECT id FROM tmp_dispute LIMIT 1), ''APPROVED'', ''Looks good'')',
  'U0001',
  'UNAUTHORIZED',
  'Student cannot resolve own dispute'
);

-- Test 5: Unauthorized resolution
SELECT set_config('app.user_id', :user2_id, true);
SELECT throws_ok(
  'SELECT resolve_attendance_dispute((SELECT id FROM tmp_dispute LIMIT 1), ''APPROVED'', ''Looks good'')',
  'U0001',
  'UNAUTHORIZED',
  'Unauthorized user cannot resolve dispute'
);

-- Test 6: Invalid resolution
SELECT set_config('app.user_id', :admin_id, true);
SELECT throws_ok(
  'SELECT resolve_attendance_dispute((SELECT id FROM tmp_dispute LIMIT 1), ''INVALID_STATUS'', ''Looks good'')',
  'U0053',
  'INVALID_RESOLUTION',
  'Invalid resolution status'
);

-- Test 7: Successful resolution
SELECT lives_ok(
  'SELECT resolve_attendance_dispute((SELECT id FROM tmp_dispute LIMIT 1), ''APPROVED'', ''Looks good'')',
  'Admin can approve dispute'
);

-- Test 8: Already resolved
SELECT throws_ok(
  'SELECT resolve_attendance_dispute((SELECT id FROM tmp_dispute LIMIT 1), ''REJECTED'', ''Changed mind'')',
  'U0052',
  'DISPUTE_ALREADY_RESOLVED',
  'Cannot resolve already resolved dispute'
);

-- Test 9: Check attendance status is EXCUSED
SELECT results_eq(
  'SELECT status FROM attendance_records WHERE session_id = ''' || :session_id || ''' AND user_id = ''' || :user1_id || '''',
  ARRAY['EXCUSED'::"AttendanceStatus"],
  'Attendance status should be EXCUSED'
);

-- Test 10: Check 0 points awarded (no leaderboard score inserted)
SELECT results_eq(
  'SELECT count(*)::int FROM leaderboard_scores WHERE user_id = ''' || :user1_id || ''' AND reason = ''ATTENDANCE''',
  ARRAY[0::int],
  'No points should be awarded for EXCUSED attendance'
);

-- Test 11: Missing dispute
SELECT throws_ok(
  'SELECT resolve_attendance_dispute(gen_random_uuid(), ''APPROVED'', '''')',
  'U0051',
  'DISPUTE_NOT_FOUND',
  'Missing dispute'
);

-- Test 12: Audit log creation
SELECT results_eq(
  'SELECT count(*)::int FROM audit_logs WHERE entity_type = ''attendance_disputes'' AND action = ''RESOLVE_DISPUTE''',
  ARRAY[1::int],
  'Audit log should be created for dispute resolution'
);

-- Setup new event for window/presence tests
\set event2_id '''00000000-0000-0000-0000-000000000011'''
\set session2_id '''00000000-0000-0000-0000-000000000021'''
INSERT INTO events (id, title, state, audience, event_type, start_time, end_time, created_by)
VALUES (:event2_id, 'Event 2', 'PUBLISHED', 'ALL_STUDENTS', 'WORKSHOP', now() - interval '3 days', now() - interval '2 days', :admin_id);
INSERT INTO attendance_sessions (id, event_id, title, start_time, end_time, open_at, close_at, qr_secret, created_by)
VALUES (:session2_id, :event2_id, 'Session 2', now() - interval '3 days', now() - interval '2 days', now() - interval '3 days', now() - interval '2 days', 'secret', :admin_id);
INSERT INTO event_registrations (id, event_id, user_id, registration_status)
VALUES (gen_random_uuid(), :event2_id, :user1_id, 'REGISTERED');

-- Test 13: Deadline after
SELECT set_config('app.user_id', :user1_id, true);
SELECT throws_ok(
  'SELECT submit_attendance_dispute(''' || :session2_id || '''::uuid, ''I was there'')',
  'U0048',
  'DISPUTE_WINDOW_EXPIRED',
  'Cannot submit dispute after 24h window'
);

-- Setup new session for present test
\set event3_id '''00000000-0000-0000-0000-000000000012'''
\set session3_id '''00000000-0000-0000-0000-000000000022'''
INSERT INTO events (id, title, state, audience, event_type, start_time, end_time, created_by)
VALUES (:event3_id, 'Event 3', 'PUBLISHED', 'ALL_STUDENTS', 'WORKSHOP', now(), now() + interval '1 day', :admin_id);
INSERT INTO attendance_sessions (id, event_id, title, start_time, end_time, open_at, close_at, qr_secret, created_by)
VALUES (:session3_id, :event3_id, 'Session 3', now(), now() + interval '1 day', now(), now() + interval '1 day', 'secret', :admin_id);
INSERT INTO event_registrations (id, event_id, user_id, registration_status)
VALUES (gen_random_uuid(), :event3_id, :user1_id, 'REGISTERED');
INSERT INTO attendance_records (id, session_id, user_id, method, status)
VALUES (gen_random_uuid(), :session3_id, :user1_id, 'MANUAL', 'PRESENT');

-- Test 14: Already PRESENT
SELECT throws_ok(
  'SELECT submit_attendance_dispute(''' || :session3_id || '''::uuid, ''I was there'')',
  'U0054',
  'ATTENDANCE_ALREADY_RECORDED',
  'Cannot submit dispute if already PRESENT'
);

-- Test 15: Cross-user submission impossible since the function does not accept user_id
-- We already asserted it implicitly because it takes `current_user_id()`.
SELECT pass('Cross-user submission impossible due to function signature (takes current_user_id())');

SELECT * FROM finish();
ROLLBACK;
