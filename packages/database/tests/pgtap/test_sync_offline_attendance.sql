BEGIN;
SELECT plan(12);

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
  VALUES (:event_id, 'Test Event', 'PUBLISHED', 'COMPETITION', now() - interval '1 hour', now() - interval '30 minutes', :user_id);
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

-- 21. sync_offline_attendance — BASIC ACCEPTANCE
SELECT lives_ok(
  $$ SELECT sync_offline_attendance(jsonb_build_array(jsonb_build_object('session_id', '00000000-0000-0000-0000-000000001000', 'user_id', '00000000-0000-0000-0000-000000000001', 'scanned_token', 'valid_totp', 'gps_lat', 18.5, 'gps_lng', 73.8, 'device_id', 'device1', 'device_os', 'ios', 'gps_accuracy', 10, 'mock_location_detected', false, 'app_version', '1.0.0', 'scan_timestamp', (now() - interval '45 minutes')))) $$,
  'sync_offline_attendance_basic_acceptance'
);
SELECT is(COUNT(*)::int, 1, 'Offline attendance record created correctly') FROM attendance_records WHERE session_id = :session_id AND user_id = :user_id;

DELETE FROM attendance_records;

-- 22. OFFLINE IDENTITY BINDING
-- We are Student A. Payload says user_id = Student B
SELECT lives_ok(
  $$ SELECT sync_offline_attendance(jsonb_build_array(jsonb_build_object('session_id', '00000000-0000-0000-0000-000000001000', 'user_id', '00000000-0000-0000-0000-000000000002', 'scanned_token', 'valid_totp_2', 'gps_lat', 18.5, 'gps_lng', 73.8, 'device_id', 'device1', 'device_os', 'ios', 'gps_accuracy', 10, 'mock_location_detected', false, 'app_version', '1.0.0', 'scan_timestamp', (now() - interval '45 minutes')))) $$,
  'sync_offline_attendance_payload_binds_identity_to_current_user'
);
SELECT is(COUNT(*)::int, 1, 'Attendance created for Student A despite payload user_id') FROM attendance_records WHERE user_id = :user_id;
SELECT is(COUNT(*)::int, 0, 'Attendance NOT created for Student B') FROM attendance_records WHERE user_id = :user2_id;

DELETE FROM attendance_records;

-- 23, 24, 25, 26, 27. Test 1 bad and 1 good to check isolation
-- 29. OFFLINE BATCH ISOLATION
SELECT lives_ok(
  $$ SELECT sync_offline_attendance(jsonb_build_array(
    jsonb_build_object('session_id', '00000000-0000-0000-0000-000000001000', 'user_id', '00000000-0000-0000-0000-000000000001', 'scanned_token', 'valid_totp_3', 'gps_lat', 18.5, 'gps_lng', 73.8, 'device_id', 'device1', 'device_os', 'ios', 'gps_accuracy', 10, 'mock_location_detected', false, 'app_version', '1.0.0', 'scan_timestamp', (now() - interval '45 minutes')),
    jsonb_build_object('session_id', '00000000-0000-0000-0000-000000001000', 'user_id', '00000000-0000-0000-0000-000000000001', 'scanned_token', 'valid_totp_4', 'gps_lat', null, 'gps_lng', 73.8, 'device_id', 'device1', 'device_os', 'ios', 'gps_accuracy', 10, 'mock_location_detected', false, 'app_version', '1.0.0', 'scan_timestamp', (now() - interval '45 minutes'))
  )) $$,
  'sync_offline_attendance_batch_isolation'
);

SELECT is(COUNT(*)::int, 1, 'Valid record from batch created') FROM attendance_records;
DELETE FROM attendance_records;

-- 28. OFFLINE 24-HOUR LOCK
-- Event ended 30 mins ago (now() - 30 minutes). Lock boundary is Event end + 24h.
-- Test A: Scan = T+1h, Sync = T+72h.
-- We'll set Event end to now() - 72h.
UPDATE events SET end_time = now() - interval '72 hours' WHERE id = :event_id;
-- Lock boundary was 48 hours ago.
-- Scan = event_end + 1h (i.e. now - 71h)
SELECT results_eq(
  $$ SELECT (sync_offline_attendance(jsonb_build_array(jsonb_build_object('session_id', '00000000-0000-0000-0000-000000001000', 'user_id', '00000000-0000-0000-0000-000000000001', 'scanned_token', 'valid_totp_8', 'gps_lat', 18.5, 'gps_lng', 73.8, 'device_id', 'device1', 'device_os', 'ios', 'gps_accuracy', 10, 'mock_location_detected', false, 'app_version', '1.0.0', 'scan_timestamp', (now() - interval '71 hours')))))->'errors'->0->>'error_code' IS NULL $$,
  $$ VALUES (true) $$,
  'sync_offline_attendance_accepts_valid_scan_after_lock'
);

-- Reset state
DELETE FROM attendance_records;

-- Case C: Scan exactly at 24h after end.
-- EXPECTED FAILURE: The fix for ATTENDANCE-07 might not be deployed yet.
SELECT results_eq(
  $$ SELECT (sync_offline_attendance(jsonb_build_array(jsonb_build_object('session_id', '00000000-0000-0000-0000-000000001000', 'user_id', '00000000-0000-0000-0000-000000000001', 'scanned_token', 'valid_totp_9', 'gps_lat', 18.5, 'gps_lng', 73.8, 'device_id', 'device1', 'device_os', 'ios', 'gps_accuracy', 10, 'mock_location_detected', false, 'app_version', '1.0.0', 'scan_timestamp', (now() - interval '48 hours')))))->'errors'->0->>'error_code' $$,
  $$ VALUES ('U0006') $$,
  'sync_offline_attendance_rejects_scan_after_24h_lock'
);

-- Case D: Scan at 24h + 1s after end.
SELECT results_eq(
  $$ SELECT (sync_offline_attendance(jsonb_build_array(jsonb_build_object('session_id', '00000000-0000-0000-0000-000000001000', 'user_id', '00000000-0000-0000-0000-000000000001', 'scanned_token', 'valid_totp_10', 'gps_lat', 18.5, 'gps_lng', 73.8, 'device_id', 'device1', 'device_os', 'ios', 'gps_accuracy', 10, 'mock_location_detected', false, 'app_version', '1.0.0', 'scan_timestamp', (now() - interval '47 hours 59 minutes 59 seconds')))))->'errors'->0->>'error_code' $$,
  $$ VALUES ('U0006') $$,
  'sync_offline_attendance_rejects_scan_after_24h_1s_lock'
);

-- PRE-FIX VULNERABILITY CHECK:
-- Does sync_offline_attendance erroneously use now() for the lock check?
-- If we pass a valid scan time (e.g. now - 71h), but the sync is happening now (now - event_end > 24h), does it fail?
-- If it passes (which it did in the test above), the bug might already be fixed, or it uses the right scan_timestamp for the 24h lock.

-- 30. OFFLINE DUPLICATES
UPDATE events SET end_time = now() + interval '1 hour' WHERE id = :event_id;
DELETE FROM attendance_records;
SELECT lives_ok(
  $$ SELECT sync_offline_attendance(jsonb_build_array(
    jsonb_build_object('session_id', '00000000-0000-0000-0000-000000001000', 'user_id', '00000000-0000-0000-0000-000000000001', 'scanned_token', 'valid_totp_11', 'gps_lat', 18.5, 'gps_lng', 73.8, 'device_id', 'device1', 'device_os', 'ios', 'gps_accuracy', 10, 'mock_location_detected', false, 'app_version', '1.0.0', 'scan_timestamp', now()),
    jsonb_build_object('session_id', '00000000-0000-0000-0000-000000001000', 'user_id', '00000000-0000-0000-0000-000000000001', 'scanned_token', 'valid_totp_11_dup', 'gps_lat', 18.5, 'gps_lng', 73.8, 'device_id', 'device1', 'device_os', 'ios', 'gps_accuracy', 10, 'mock_location_detected', false, 'app_version', '1.0.0', 'scan_timestamp', now())
  )) $$,
  'sync_offline_attendance_handles_duplicates'
);
SELECT is(COUNT(*)::int, 1, 'Only one record created for duplicate payload items') FROM attendance_records;

SELECT * FROM finish();
ROLLBACK;
