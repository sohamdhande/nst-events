BEGIN;
SELECT plan(6);

-- 1. Setup Data
\set mentor_id '11111111-1111-1111-1111-111111111111'
\set target_user_id '22222222-2222-2222-2222-222222222222'
\set club_id '33333333-3333-3333-3333-333333333333'
\set target_membership_id '44444444-4444-4444-4444-444444444444'

INSERT INTO users (id, email, google_sub, full_name, global_role) VALUES 
(:'mentor_id'::uuid, 'mentor@test.com', 'g_sub_mentor', 'Mentor', 'STUDENT'),
(:'target_user_id'::uuid, 'target@test.com', 'g_sub_target', 'Target', 'STUDENT');

INSERT INTO clubs (id, name, status) VALUES (:'club_id'::uuid, 'RLS Test Club', 'ACTIVE');

-- Mentor is FACULTY_MENTOR in the club
INSERT INTO club_memberships (id, club_id, user_id, role) VALUES 
(gen_random_uuid(), :'club_id'::uuid, :'mentor_id'::uuid, 'FACULTY_MENTOR');

-- Target is a MEMBER
INSERT INTO club_memberships (id, club_id, user_id, role) VALUES 
(:'target_membership_id'::uuid, :'club_id'::uuid, :'target_user_id'::uuid, 'MEMBER');

-- Switch to the mentor user
SELECT set_config('app.user_id', :'mentor_id', true);
SET ROLE authenticated;

-- Test 1: SELECT should be allowed (returns 2 memberships)
SELECT results_eq(
    $$ SELECT COUNT(*)::int FROM club_memberships WHERE club_id = '33333333-3333-3333-3333-333333333333' $$,
    ARRAY[2],
    'Faculty Mentor can SELECT club_memberships'
);

-- Test 2: INSERT should fail with RLS violation
SELECT throws_matching(
    $$ INSERT INTO club_memberships (id, club_id, user_id, role) VALUES (gen_random_uuid(), '33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', 'MEMBER') $$,
    'new row violates row-level security policy for table "club_memberships"',
    'Faculty Mentor cannot INSERT into club_memberships'
);

-- Test 3: UPDATE should fail or affect 0 rows (depending on whether they can see the row to update it, they can, but UPDATE policy fails)
-- If UPDATE policy USING clause fails, it acts as if the row isn't there, so it updates 0 rows.
-- Wait, if it's 0 rows, it doesn't throw an error, it just returns 0.
PREPARE update_membership AS UPDATE club_memberships SET role = 'CORE_MEMBER' WHERE id = '44444444-4444-4444-4444-444444444444';
EXECUTE update_membership;
SELECT results_eq(
    $$ SELECT role::text FROM club_memberships WHERE id = '44444444-4444-4444-4444-444444444444' $$,
    ARRAY['MEMBER'],
    'Faculty Mentor cannot UPDATE club_memberships (0 rows affected)'
);

-- Test 4: DELETE should affect 0 rows
PREPARE delete_membership AS DELETE FROM club_memberships WHERE id = '44444444-4444-4444-4444-444444444444';
EXECUTE delete_membership;
SELECT results_eq(
    $$ SELECT COUNT(*)::int FROM club_memberships WHERE id = '44444444-4444-4444-4444-444444444444' $$,
    ARRAY[1],
    'Faculty Mentor cannot DELETE club_memberships (0 rows affected)'
);

-- Switch back to admin to test that PLATFORM_ADMIN can mutate
SET ROLE postgres;
SELECT set_config('app.user_id', '', true);

-- Add a platform admin
\set platform_admin_id '55555555-5555-5555-5555-555555555555'
INSERT INTO users (id, email, google_sub, full_name, global_role) VALUES 
(:'platform_admin_id'::uuid, 'admin@test.com', 'g_sub_admin', 'Admin', 'PLATFORM_ADMIN');

SELECT set_config('app.user_id', :'platform_admin_id', true);
SET ROLE authenticated;

-- PLATFORM_ADMIN UPDATE
UPDATE club_memberships SET role = 'CORE_MEMBER' WHERE id = '44444444-4444-4444-4444-444444444444';
SELECT results_eq(
    $$ SELECT role::text FROM club_memberships WHERE id = '44444444-4444-4444-4444-444444444444' $$,
    ARRAY['CORE_MEMBER'],
    'Platform Admin can UPDATE club_memberships'
);

-- PLATFORM_ADMIN DELETE
DELETE FROM club_memberships WHERE id = '44444444-4444-4444-4444-444444444444';
SELECT results_eq(
    $$ SELECT COUNT(*)::int FROM club_memberships WHERE id = '44444444-4444-4444-4444-444444444444' $$,
    ARRAY[0],
    'Platform Admin can DELETE club_memberships'
);

SELECT * FROM finish();
ROLLBACK;
