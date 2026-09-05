-- Drop Invitation Table and Enum
DROP TABLE IF EXISTS "team_invitations" CASCADE;
DROP TYPE IF EXISTS "InvitationStatus" CASCADE;

-- Drop RPC for accepting invitation
DROP FUNCTION IF EXISTS public.accept_invitation(uuid, uuid, uuid);

-- Pre-migration safety check: Ensure no existing teams have colliding normalized names within the same event
DO $$
DECLARE duplicate_count INT;
BEGIN
  SELECT COUNT(*) INTO duplicate_count FROM (
    SELECT event_id, lower(trim(name)) FROM teams GROUP BY event_id, lower(trim(name)) HAVING COUNT(*) > 1
  ) sub;
  IF duplicate_count > 0 THEN
    RAISE EXCEPTION 'MIGRATION ABORTED: Duplicate normalized team names found. Please resolve manually.';
  END IF;
END $$;

-- Add normalized_name to teams
ALTER TABLE "teams" ADD COLUMN "normalized_name" TEXT;

-- Backfill normalized_name
UPDATE "teams" SET "normalized_name" = lower(trim(name));

-- Make normalized_name NOT NULL
ALTER TABLE "teams" ALTER COLUMN "normalized_name" SET NOT NULL;

-- Replace unique constraint
ALTER TABLE "teams" DROP CONSTRAINT IF EXISTS "teams_event_id_name_key";
ALTER TABLE "teams" ADD CONSTRAINT "teams_event_id_normalized_name_key" UNIQUE ("event_id", "normalized_name");

-- Update create_team RPC to handle uniqueness and normalized_name
CREATE OR REPLACE FUNCTION public.create_team(p_event_id uuid, p_name text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_caller_id UUID := current_user_id();
  v_team teams;
  v_reg event_registrations;
  v_event events;
  v_normalized_name TEXT := lower(trim(p_name));
BEGIN
  IF v_caller_id IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;

  SELECT * INTO v_event FROM events WHERE id = p_event_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Event not found'; END IF;
  IF v_event.state != 'PUBLISHED' THEN RAISE EXCEPTION 'Event not published'; END IF;
  IF v_event.registration_type != 'TEAM' THEN RAISE EXCEPTION 'Event does not support teams'; END IF;
  IF v_event.is_locked = true OR now() >= v_event.end_time + interval '24 hours' THEN 
    RAISE EXCEPTION 'Event is locked' USING ERRCODE = 'U0030'; 
  END IF;

  -- ENFORCE: Registration Eligibility
  IF v_event.audience = 'SPECIFIC_BATCHES' THEN
    IF NOT EXISTS (
      SELECT 1 FROM user_academic_profiles uap
      JOIN event_audience_batches eab ON eab.batch_id = uap.batch_id
      WHERE uap.user_id = v_caller_id AND eab.event_id = p_event_id
    ) THEN
      RAISE EXCEPTION 'ACADEMICALLY_INELIGIBLE' USING ERRCODE = 'U0031';
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM event_registrations WHERE event_id = p_event_id AND user_id = v_caller_id AND registration_status != 'CANCELLED') THEN
    RAISE EXCEPTION 'Already in a team for this event.' USING ERRCODE = 'U0020';
  END IF;

  -- ENFORCE: Team Name Uniqueness (convenience pre-check for clean error, though unique constraint is final authority)
  IF EXISTS (SELECT 1 FROM teams WHERE event_id = p_event_id AND normalized_name = v_normalized_name) THEN
    RAISE EXCEPTION 'TEAM_NAME_TAKEN' USING ERRCODE = 'U0055';
  END IF;

  BEGIN
    INSERT INTO teams (id, event_id, name, normalized_name, leader_id, status)
    VALUES (gen_random_uuid(), p_event_id, p_name, v_normalized_name, v_caller_id, 'FORMING')
    RETURNING * INTO v_team;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'TEAM_NAME_TAKEN' USING ERRCODE = 'U0055';
  END;

  INSERT INTO event_registrations (id, event_id, user_id, team_id, registration_status)
  VALUES (gen_random_uuid(), p_event_id, v_caller_id, v_team.id, 'WAITLISTED')
  RETURNING * INTO v_reg;

  RETURN json_build_object('team_id', v_team.id, 'status', 'FORMING', 'registration_id', v_reg.id);
END;
$function$;
