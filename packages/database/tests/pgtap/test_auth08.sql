BEGIN;
SELECT plan(13);

\set user_id '''00000000-0000-0000-0000-000000000001'''::uuid
\set user2_id '''00000000-0000-0000-0000-000000000002'''::uuid
\set user3_id '''00000000-0000-0000-0000-000000000003'''::uuid
\set club_id '''00000000-0000-0000-0000-000000000010'''::uuid
\set event_id '''00000000-0000-0000-0000-000000000100'''::uuid
\set team_event_id '''00000000-0000-0000-0000-000000000101'''::uuid
\set prog_id '''00000000-0000-0000-0000-000000010000'''::uuid
\set batch_id '''00000000-0000-0000-0000-000000100000'''::uuid
\set batch2_id '''00000000-0000-0000-0000-000000200000'''::uuid

INSERT INTO users (id, email, full_name, global_role, google_sub) VALUES 
  (:user_id, 'test1@adypu.edu.in', 'Student 1', 'STUDENT', 'sub1'),
  (:user2_id, 'test2@adypu.edu.in', 'Student 2', 'STUDENT', 'sub2'),
  (:user3_id, 'test3@adypu.edu.in', 'Student 3', 'STUDENT', 'sub3');

INSERT INTO academic_programs (id, name, code) VALUES (:prog_id, 'Test Prog', 'TPROG');
INSERT INTO academic_batches (id, program_id, admission_year, graduation_year) VALUES 
  (:batch_id, :prog_id, 2021, 2025),
  (:batch2_id, :prog_id, 2022, 2026);

INSERT INTO user_academic_profiles (id, user_id, batch_id, assignment_source) VALUES 
  (gen_random_uuid(), :user_id, :batch_id, 'INSTITUTIONAL_EMAIL_INFERENCE'),
  (gen_random_uuid(), :user2_id, :batch_id, 'INSTITUTIONAL_EMAIL_INFERENCE'),
  (gen_random_uuid(), :user3_id, :batch2_id, 'INSTITUTIONAL_EMAIL_INFERENCE');

INSERT INTO clubs (id, name) VALUES (:club_id, 'Test Club');

-- Create a SPECIFIC_BATCHES event for individual
INSERT INTO events (id, title, state, event_type, audience, registration_type, max_capacity, start_time, end_time, created_by) 
  VALUES (:event_id, 'Individual Event', 'PUBLISHED', 'COMPETITION', 'SPECIFIC_BATCHES', 'INDIVIDUAL', 2, now() - interval '1 hour', now() + interval '1 hour', :user_id);
INSERT INTO event_clubs (event_id, club_id, is_primary) VALUES (:event_id, :club_id, true);
INSERT INTO event_audience_batches (id, event_id, batch_id) VALUES (gen_random_uuid(), :event_id, :batch_id);

-- Create a SPECIFIC_BATCHES event for team
INSERT INTO events (id, title, state, event_type, audience, registration_type, max_capacity, metadata, start_time, end_time, created_by) 
  VALUES (:team_event_id, 'Team Event', 'PUBLISHED', 'COMPETITION', 'SPECIFIC_BATCHES', 'TEAM', 4, '{"minimum_team_size": 2, "maximum_team_size": 3}'::jsonb, now() - interval '1 hour', now() + interval '1 hour', :user_id);
INSERT INTO event_clubs (event_id, club_id, is_primary) VALUES (:team_event_id, :club_id, true);
INSERT INTO event_audience_batches (id, event_id, batch_id) VALUES (gen_random_uuid(), :team_event_id, :batch_id);

-- TEST 1: user1 registers for event successfully (is in batch 1)
SELECT set_config('app.user_id', :user_id::text, true);
SELECT lives_ok($$ SELECT register_event('00000000-0000-0000-0000-000000000100'::uuid) $$, 'Eligible user can register');
SELECT is(registration_status::text, 'REGISTERED', 'Status is REGISTERED') FROM event_registrations WHERE user_id = :user_id AND event_id = :event_id;
SELECT is(eligibility_scope_snapshot::text, 'SPECIFIC_BATCHES', 'Scope snapshot correct') FROM event_registrations WHERE user_id = :user_id AND event_id = :event_id;
SELECT is(academic_batch_id_snapshot, :batch_id, 'Batch snapshot correct') FROM event_registrations WHERE user_id = :user_id AND event_id = :event_id;

-- TEST 2: user3 tries to register but is in batch 2
SELECT set_config('app.user_id', :user3_id::text, true);
SELECT throws_ok($$ SELECT register_event('00000000-0000-0000-0000-000000000100'::uuid) $$, 'U0013', 'ACADEMICALLY_INELIGIBLE', 'Ineligible user rejected');

-- TEST 3: user2 registers and fills capacity (max_capacity = 2)
SELECT set_config('app.user_id', :user2_id::text, true);
SELECT lives_ok($$ SELECT register_event('00000000-0000-0000-0000-000000000100'::uuid) $$, 'Eligible user 2 can register');
SELECT is(registration_status::text, 'REGISTERED', 'Status is REGISTERED') FROM event_registrations WHERE user_id = :user2_id AND event_id = :event_id;

-- TEST 4: change user3 to batch 1 to make eligible, then register (should WAITLIST)
UPDATE user_academic_profiles SET batch_id = :batch_id WHERE user_id = :user3_id;
SELECT set_config('app.user_id', :user3_id::text, true);
SELECT lives_ok($$ SELECT register_event('00000000-0000-0000-0000-000000000100'::uuid) $$, 'User 3 registers');
SELECT is(registration_status::text, 'WAITLISTED', 'Status is WAITLISTED (capacity full)') FROM event_registrations WHERE user_id = :user3_id AND event_id = :event_id;

-- TEST 5: Team creation eligibility
SELECT set_config('app.user_id', :user3_id::text, true);
SELECT lives_ok($$ SELECT create_team('00000000-0000-0000-0000-000000000101'::uuid, 'My Team') $$, 'Eligible user creates team');

-- Move user2 to batch 2 (ineligible for team_event_id)
UPDATE user_academic_profiles SET batch_id = :batch2_id WHERE user_id = :user2_id;
SELECT set_config('app.user_id', :user2_id::text, true);
SELECT throws_ok(
  $$ SELECT join_team('00000000-0000-0000-0000-000000000101'::uuid, (SELECT id FROM teams WHERE event_id = '00000000-0000-0000-0000-000000000101'::uuid AND leader_id = '00000000-0000-0000-0000-000000000003'::uuid LIMIT 1)) $$,
  'U0013', 'ACADEMICALLY_INELIGIBLE', 'Ineligible user rejected from joining team'
);

-- TEST 6: Event lock
UPDATE events SET is_locked = true WHERE id = :event_id;
SELECT set_config('app.user_id', :user_id::text, true);
-- Delete user1 reg to try again
DELETE FROM event_registrations WHERE user_id = :user_id AND event_id = :event_id;
SELECT throws_ok($$ SELECT register_event('00000000-0000-0000-0000-000000000100'::uuid) $$, 'U0006', 'EVENT_LOCKED', 'Locked event rejects registration');

-- Unlock event, set end_time far in past
UPDATE events SET is_locked = false, end_time = now() - interval '25 hours' WHERE id = :event_id;
SELECT throws_ok($$ SELECT register_event('00000000-0000-0000-0000-000000000100'::uuid) $$, 'U0006', 'EVENT_LOCKED', 'Expired event rejects registration');

SELECT * FROM finish();
ROLLBACK;
