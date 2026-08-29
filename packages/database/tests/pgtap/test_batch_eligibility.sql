BEGIN;
SELECT plan(3);
SELECT has_function('public', 'is_users_available_for_team', ARRAY['uuid', 'uuid', 'uuid[]'], 'is_users_available_for_team batch function exists');
-- Not testing business logic exhaustively, just ensuring the signature and basic usage works.
SELECT results_eq(
  $$ SELECT is_available FROM public.is_users_available_for_team('00000000-0000-0000-0000-000000000000'::uuid, '00000000-0000-0000-0000-000000000000'::uuid, ARRAY['00000000-0000-0000-0000-000000000000'::uuid]) $$,
  $$ VALUES (false) $$,
  'Batch function handles missing team/event correctly and returns false'
);
SELECT results_eq(
  $$ SELECT user_id FROM public.is_users_available_for_team('00000000-0000-0000-0000-000000000000'::uuid, '00000000-0000-0000-0000-000000000000'::uuid, ARRAY['00000000-0000-0000-0000-000000000000'::uuid]) $$,
  $$ VALUES ('00000000-0000-0000-0000-000000000000'::uuid) $$,
  'Batch function returns the queried user_id'
);
SELECT * FROM finish();
ROLLBACK;
