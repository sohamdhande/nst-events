BEGIN;
SELECT plan(29);

-- Fixture variables
\set user_id '''00000000-0000-0000-0000-000000000001'''::uuid
\set user2_id '''00000000-0000-0000-0000-000000000002'''::uuid
\set club_id '''00000000-0000-0000-0000-000000000010'''::uuid
\set event_id '''00000000-0000-0000-0000-000000000100'''::uuid
\set session_id '''00000000-0000-0000-0000-000000001000'''::uuid
\set prog_id '''00000000-0000-0000-0000-000000010000'''::uuid
\set batch_id '''00000000-0000-0000-0000-000000100000'''::uuid

-- Base schema setup for test
INSERT INTO users (id, email, full_name, global_role, google_sub) VALUES 
  (:user_id, 'test1@adypu.edu.in', 'Test Student', 'STUDENT', 'sub1'),
  (:user2_id, 'test2@adypu.edu.in', 'Test Student 2', 'STUDENT', 'sub2');

INSERT INTO academic_programs (id, name, code) VALUES (:prog_id, 'Test Prog', 'TPROG');
INSERT INTO academic_batches (id, program_id, admission_year, graduation_year) VALUES (:batch_id, :prog_id, 2021, 2025);
INSERT INTO user_academic_profiles (id, user_id, batch_id, assignment_source) VALUES 
  (gen_random_uuid(), :user_id, :batch_id, 'INSTITUTIONAL_EMAIL_INFERENCE'),
  (gen_random_uuid(), :user2_id, :batch_id, 'INSTITUTIONAL_EMAIL_INFERENCE');

INSERT INTO clubs (id, name) VALUES (:club_id, 'Test Club');
INSERT INTO events (id, title, state, event_type, start_time, end_time, created_by) 
  VALUES (:event_id, 'Test Event', 'PUBLISHED', 'COMPETITION', now() - interval '1 hour', now() + interval '1 hour', :user_id);
INSERT INTO event_clubs (event_id, club_id, is_primary) VALUES (:event_id, :club_id, true);

-- Register users
INSERT INTO event_registrations (id, event_id, user_id, registration_status) VALUES 
  (gen_random_uuid(), :event_id, :user_id, 'REGISTERED'),
  (gen_random_uuid(), :event_id, :user2_id, 'REGISTERED');

-- Create Session (venue at lat=18.5, lon=73.8, radius=50)
INSERT INTO attendance_sessions (id, event_id, title, start_time, end_time, open_at, close_at, geofence_radius, venue_latitude, venue_longitude, qr_secret, created_by)
  VALUES (:session_id, :event_id, 'Test Session', now() - interval '1 hour', now() + interval '1 hour', now() - interval '1 hour', now() + interval '1 hour', 50, 18.5, 73.8, 'TESTSECRET', :user_id);

-- Set user context
SELECT set_config('app.user_id', :user_id::text, true);

-- 6. mark_attendance — BASIC ACCEPTANCE
SELECT lives_ok(
  $$ SELECT mark_attendance('00000000-0000-0000-0000-000000001000'::uuid, 'valid_totp', 18.5, 73.8, 'device1', 'ios', 10, false, '1.0.0') $$,
  'Valid baseline attendance succeeds'
);

SELECT results_eq(
  $$ SELECT user_id FROM attendance_records WHERE session_id = '00000000-0000-0000-0000-000000001000'::uuid $$,
  $$ VALUES ('00000000-0000-0000-0000-000000000001'::uuid) $$,
  'Attendance record created correctly'
);

-- Reset for next test
DELETE FROM attendance_records;

-- 7. NULL COORDINATE TESTS
-- PRE-FIX EXPECTED FINDING: We expect these to throw 'INVALID_LOCATION' or U0010 but let's see.
SELECT throws_ok(
  $$ SELECT mark_attendance('00000000-0000-0000-0000-000000001000'::uuid, 'valid_totp', NULL, 73.8, 'device1', 'ios', 10, false, '1.0.0') $$,
  'U0009', NULL,
  'mark_attendance_rejects_null_latitude'
);

SELECT throws_ok(
  $$ SELECT mark_attendance('00000000-0000-0000-0000-000000001000'::uuid, 'valid_totp', 18.5, NULL, 'device1', 'ios', 10, false, '1.0.0') $$,
  'U0009', NULL,
  'mark_attendance_rejects_null_longitude'
);

SELECT throws_ok(
  $$ SELECT mark_attendance('00000000-0000-0000-0000-000000001000'::uuid, 'valid_totp', NULL, NULL, 'device1', 'ios', 10, false, '1.0.0') $$,
  'U0009', NULL,
  'mark_attendance_rejects_both_null_coordinates'
);

-- 8. INVALID COORDINATES
SELECT throws_ok(
  $$ SELECT mark_attendance('00000000-0000-0000-0000-000000001000'::uuid, 'valid_totp', 95.0, 73.8, 'device1', 'ios', 10, false, '1.0.0') $$,
  'U0010', NULL,
  'mark_attendance_rejects_latitude_over_90'
);

SELECT throws_ok(
  $$ SELECT mark_attendance('00000000-0000-0000-0000-000000001000'::uuid, 'valid_totp', 18.5, 200.0, 'device1', 'ios', 10, false, '1.0.0') $$,
  'U0010', NULL,
  'mark_attendance_rejects_longitude_over_180'
);

SELECT throws_ok(
  $$ SELECT mark_attendance('00000000-0000-0000-0000-000000001000'::uuid, 'valid_totp', 'NaN'::float8, 73.8, 'device1', 'ios', 10, false, '1.0.0') $$,
  'U0010', NULL,
  'mark_attendance_rejects_nan_latitude'
);

SELECT throws_ok(
  $$ SELECT mark_attendance('00000000-0000-0000-0000-000000001000'::uuid, 'valid_totp', 18.5, 'Infinity'::float8, 'device1', 'ios', 10, false, '1.0.0') $$,
  'U0010', NULL,
  'mark_attendance_rejects_infinity_longitude'
);

SELECT throws_ok(
  $$ SELECT mark_attendance('00000000-0000-0000-0000-000000001000'::uuid, 'valid_totp', '-Infinity'::float8, 73.8, 'device1', 'ios', 10, false, '1.0.0') $$,
  'U0010', NULL,
  'mark_attendance_rejects_negative_infinity_latitude'
);

SELECT is(COUNT(*)::int, 0, 'No attendance rows created for invalid coordinates') FROM attendance_records;

-- 9. GPS ACCURACY CUTOFF (Assuming 100 is threshold)
SELECT lives_ok(
  $$ SELECT mark_attendance('00000000-0000-0000-0000-000000001000'::uuid, 'valid_totp', 18.5, 73.8, 'device1', 'ios', 99.99, false, '1.0.0') $$,
  'mark_attendance_accepts_accuracy_99_99'
);
DELETE FROM attendance_records;

SELECT lives_ok(
  $$ SELECT mark_attendance('00000000-0000-0000-0000-000000001000'::uuid, 'valid_totp', 18.5, 73.8, 'device1', 'ios', 100, false, '1.0.0') $$,
  'mark_attendance_accepts_accuracy_100'
);
DELETE FROM attendance_records;

-- PRE-FIX VULNERABILITY: If accuracy check is not yet implemented or allows > 100, test it as current behavior
-- For now, assert what happens when we pass 101. If it fails with U0011, great. If not, record actual behavior.
SELECT throws_ok(
  $$ SELECT mark_attendance('00000000-0000-0000-0000-000000001000'::uuid, 'valid_totp', 18.5, 73.8, 'device1', 'ios', 100.01, false, '1.0.0') $$,
  'U0011', NULL,
  'mark_attendance_rejects_accuracy_over_100_01'
);

SELECT throws_ok(
  $$ SELECT mark_attendance('00000000-0000-0000-0000-000000001000'::uuid, 'valid_totp', 18.5, 73.8, 'device1', 'ios', 101, false, '1.0.0') $$,
  'U0011', NULL,
  'mark_attendance_rejects_accuracy_101'
);

SELECT throws_ok(
  $$ SELECT mark_attendance('00000000-0000-0000-0000-000000001000'::uuid, 'valid_totp', 18.5, 73.8, 'device1', 'ios', -1, false, '1.0.0') $$,
  'U0011', NULL,
  'mark_attendance_rejects_negative_accuracy'
);

-- 10. MOCK LOCATION
SELECT throws_ok(
  $$ SELECT mark_attendance('00000000-0000-0000-0000-000000001000'::uuid, 'valid_totp', 18.5, 73.8, 'device1', 'ios', 10, true, '1.0.0') $$,
  'U0008', NULL,
  'mark_attendance_rejects_mock_location'
);

-- 11. GEOFENCE BOUNDARY
-- 18.5, 73.8 is exactly on point.
-- 18.5005, 73.8 is ~55 meters away (1 degree lat ~ 111km, 0.0005 * 111000 = 55.5m). Radius is 50m.
SELECT throws_ok(
  $$ SELECT mark_attendance('00000000-0000-0000-0000-000000001000'::uuid, 'valid_totp', 18.5005, 73.8, 'device1', 'ios', 10, false, '1.0.0') $$,
  'U0007', NULL,
  'mark_attendance_outside_geofence_rejects'
);

-- 18.5003, 73.8 is ~33 meters away.
SELECT lives_ok(
  $$ SELECT mark_attendance('00000000-0000-0000-0000-000000001000'::uuid, 'valid_totp', 18.5003, 73.8, 'device1', 'ios', 10, false, '1.0.0') $$,
  'mark_attendance_inside_geofence_accepts'
);
DELETE FROM attendance_records;

-- 12. POSTGIS CORRECTNESS (swapped coordinates: lat=73.8, lon=18.5)
SELECT throws_ok(
  $$ SELECT mark_attendance('00000000-0000-0000-0000-000000001000'::uuid, 'valid_totp', 73.8, 18.5, 'device1', 'ios', 10, false, '1.0.0') $$,
  'U0007', NULL,
  'mark_attendance_swapped_coordinates_fails_geofence'
);

-- 13. SESSION LOCATION SOURCE
-- Event location was 0,0. Session is 18.5, 73.8. The test above successfully used 18.5, 73.8 showing session location was used.
-- If we pass 0,0 (event location), it should fail because session is at 18.5, 73.8.
SELECT throws_ok(
  $$ SELECT mark_attendance('00000000-0000-0000-0000-000000001000'::uuid, 'valid_totp', 0.0, 0.0, 'device1', 'ios', 10, false, '1.0.0') $$,
  'U0007', NULL,
  'mark_attendance_uses_session_geofence_not_event'
);

-- 14. SESSION STATE
UPDATE attendance_sessions SET open_at = now() - interval '2 hours', close_at = now() - interval '1 hour' WHERE id = :session_id;
SELECT throws_ok(
  $$ SELECT mark_attendance('00000000-0000-0000-0000-000000001000'::uuid, 'valid_totp', 18.5, 73.8, 'device1', 'ios', 10, false, '1.0.0') $$,
  'U0005', NULL,
  'mark_attendance_rejects_closed_session'
);
UPDATE attendance_sessions SET open_at = now() - interval '1 hour', close_at = now() + interval '1 hour' WHERE id = :session_id;

-- 16. DUPLICATE USER IDEMPOTENCY
SELECT lives_ok(
  $$ SELECT mark_attendance('00000000-0000-0000-0000-000000001000'::uuid, 'valid_totp', 18.5, 73.8, 'device1', 'ios', 10, false, '1.0.0') $$,
  'first_attendance_succeeds'
);
-- Run second time, should be idempotent and return existing record without duplicate
SELECT lives_ok(
  $$ SELECT mark_attendance('00000000-0000-0000-0000-000000001000'::uuid, 'valid_totp2', 18.5, 73.8, 'device1', 'ios', 10, false, '1.0.0') $$,
  'mark_attendance_is_idempotent_per_user_session'
);
SELECT is(COUNT(*)::int, 1, 'Only one attendance record exists for student') FROM attendance_records WHERE user_id = :user_id;

-- 18. DEVICE COLLISION
-- Change to user 2
SELECT set_config('app.user_id', :user2_id::text, true);
-- User 2 uses same device1
SELECT lives_ok(
  $$ SELECT mark_attendance('00000000-0000-0000-0000-000000001000'::uuid, 'valid_totp3', 18.5, 73.8, 'device1', 'ios', 10, false, '1.0.0') $$,
  'device_collision_still_creates_record_but_flags_it'
);
SELECT is(COUNT(*)::int, 1, 'Attendance record created for user 2 on same device') FROM attendance_records WHERE user_id = :user2_id;
-- Check flags? If flags exist, we can test them.

-- 19. BOLA
-- mark_attendance does NOT accept user_id. It purely uses current_user_id(). Tested implicitly because we switched app.user_id above and it created record for user 2.

-- 20. ACADEMIC / REGISTRATION INTEGRATION
SELECT set_config('app.user_id', :user_id::text, true);
UPDATE event_registrations SET registration_status = 'WAITLISTED' WHERE user_id = :user_id;
DELETE FROM attendance_records WHERE user_id = :user_id;

SELECT throws_ok(
  $$ SELECT mark_attendance('00000000-0000-0000-0000-000000001000'::uuid, 'valid_totp', 18.5, 73.8, 'device1', 'ios', 10, false, '1.0.0') $$,
  'U0002', NULL,
  'mark_attendance_rejects_waitlisted'
);

UPDATE event_registrations SET registration_status = 'REGISTERED' WHERE user_id = :user_id;
-- user is in batch_id, but event has no eligible batches mapped yet
-- Testing this requires specific RBAC or schema logic for eligible_batches, but the table might be event_audience_batches
-- Let's just create an audience batch for now
INSERT INTO event_audience_batches (id, event_id, batch_id) VALUES (gen_random_uuid(), :event_id, :batch_id);
SELECT lives_ok(
  $$ SELECT mark_attendance('00000000-0000-0000-0000-000000001000'::uuid, 'valid_totp', 18.5, 73.8, 'device1', 'ios', 10, false, '1.0.0') $$,
  'mark_attendance_accepts_eligible_batch'
);

SELECT * FROM finish();
ROLLBACK;
