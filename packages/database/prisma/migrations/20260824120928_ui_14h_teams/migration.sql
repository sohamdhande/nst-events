-- CreateEnum
CREATE TYPE "TeamStatus" AS ENUM ('FORMING', 'REGISTERED', 'WAITLISTED', 'CANCELLED');
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED', 'EXPIRED');

-- AlterTable
ALTER TABLE "teams" ADD COLUMN "status" "TeamStatus" NOT NULL DEFAULT 'FORMING';

-- CreateTable
CREATE TABLE "team_invitations" (
    "id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "invitee_id" UUID NOT NULL,
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "responded_at" TIMESTAMPTZ,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "team_invitations_team_id_idx" ON "team_invitations"("team_id");
CREATE INDEX "team_invitations_invitee_id_idx" ON "team_invitations"("invitee_id");
CREATE INDEX "team_invitations_status_idx" ON "team_invitations"("status");
CREATE INDEX "team_invitations_expires_at_idx" ON "team_invitations"("expires_at");

-- AddForeignKey
ALTER TABLE "team_invitations" ADD CONSTRAINT "team_invitations_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "team_invitations" ADD CONSTRAINT "team_invitations_invitee_id_fkey" FOREIGN KEY ("invitee_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Update `process_waitlist` for team level FIFO
CREATE OR REPLACE FUNCTION process_waitlist(p_event_id UUID)
RETURNS UUID[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_promoted_ids UUID[] := ARRAY[]::UUID[];
  v_team RECORD;
  v_member_ids UUID[];
  v_capacity_left INT;
  v_event events;
BEGIN
  -- Re-read event capacity to ensure we don't violate bounds
  SELECT * INTO v_event FROM events WHERE id = p_event_id FOR UPDATE;

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
    -- (The exact mechanism for FIFO is using the team's oldest waitlisted registration or waitlisted status)
    -- V1 formula: First we find teams that are waitlisted
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
    ) ASC
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
      SET registration_status = 'REGISTERED' 
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
  
  RETURN v_promoted_ids;
END;
$$;


-- `create_team`
CREATE OR REPLACE FUNCTION create_team(p_event_id UUID, p_team_name TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID := current_user_id();
  v_team teams;
  v_event events;
BEGIN
  IF v_caller_id IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;

  SELECT * INTO v_event FROM events WHERE id = p_event_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Event not found'; END IF;
  IF v_event.state != 'PUBLISHED' THEN RAISE EXCEPTION 'Event not published'; END IF;
  IF v_event.registration_type != 'TEAM' THEN RAISE EXCEPTION 'Event does not support teams'; END IF;
  IF v_event.is_locked = true THEN RAISE EXCEPTION 'Event is locked'; END IF;

  -- Ensure user doesn't already have an active team for this event
  PERFORM 1 FROM event_registrations 
  WHERE event_id = p_event_id AND user_id = v_caller_id AND deleted_at IS NULL;
  IF FOUND THEN RAISE EXCEPTION 'Already in a team'; END IF;

  -- Create team as FORMING (capacity = 0)
  INSERT INTO teams (event_id, name, leader_id, status)
  VALUES (p_event_id, p_team_name, v_caller_id, 'FORMING')
  RETURNING * INTO v_team;

  -- Add leader to event_registrations (as WAITLISTED or FORMING conceptually, but we store it as WAITLISTED for individual member until team registers)
  -- Actually, the simplest is to store the member as WAITLISTED (or some non-capacity state), but V1 contract states: 
  -- "FORMING team doesn't consume capacity". So registration_status='WAITLISTED' works fine since it has 0 capacity weight, and when team reaches min size, both team and members become 'REGISTERED'.
  INSERT INTO event_registrations (event_id, user_id, team_id, registration_status)
  VALUES (p_event_id, v_caller_id, v_team.id, 'WAITLISTED');

  RETURN v_team.id;
END;
$$;


-- `accept_invitation`
CREATE OR REPLACE FUNCTION accept_invitation(p_event_id UUID, p_team_id UUID, p_invitation_id UUID)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID := current_user_id();
  v_reg event_registrations;
  v_event events;
  v_team teams;
  v_invitation team_invitations;
  v_team_size INT;
  v_team_size_max INT;
  v_team_size_min INT;
BEGIN
  IF v_caller_id IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;

  SELECT * INTO v_event FROM events WHERE id = p_event_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Event not found'; END IF;
  IF v_event.state != 'PUBLISHED' THEN RAISE EXCEPTION 'Event not published'; END IF;
  IF v_event.registration_type != 'TEAM' THEN RAISE EXCEPTION 'Event does not support teams'; END IF;
  IF v_event.is_locked = true THEN RAISE EXCEPTION 'Event is locked'; END IF;

  SELECT * INTO v_team FROM teams WHERE id = p_team_id AND event_id = p_event_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Team not found'; END IF;

  SELECT * INTO v_invitation FROM team_invitations WHERE id = p_invitation_id AND team_id = p_team_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invitation not found'; END IF;
  IF v_invitation.invitee_id != v_caller_id THEN RAISE EXCEPTION 'Invitation not for user'; END IF;
  IF v_invitation.status != 'PENDING' THEN RAISE EXCEPTION 'Invitation invalid'; END IF;
  IF now() >= v_invitation.expires_at THEN RAISE EXCEPTION 'Invitation expired'; END IF;

  -- Ensure user not already registered
  PERFORM 1 FROM event_registrations 
  WHERE event_id = p_event_id AND user_id = v_caller_id AND deleted_at IS NULL;
  IF FOUND THEN RAISE EXCEPTION 'Already in a team'; END IF;

  v_team_size_max := (v_event.metadata->>'maximum_team_size')::INT;
  v_team_size_min := (v_event.metadata->>'minimum_team_size')::INT;

  SELECT count(*) INTO v_team_size FROM event_registrations WHERE team_id = p_team_id AND deleted_at IS NULL;
  IF v_team_size_max IS NOT NULL AND v_team_size >= v_team_size_max THEN
    RAISE EXCEPTION 'Team is full';
  END IF;

  UPDATE team_invitations SET status = 'ACCEPTED', responded_at = now() WHERE id = p_invitation_id;

  v_team_size := v_team_size + 1;

  -- Evaluate transitions
  IF v_team.status = 'FORMING' THEN
    IF v_team_size >= v_team_size_min THEN
      -- Try to register
      IF v_event.max_capacity IS NULL OR (v_event.registration_count + v_team_size) <= v_event.max_capacity THEN
        UPDATE teams SET status = 'REGISTERED' WHERE id = p_team_id;
        UPDATE event_registrations SET registration_status = 'REGISTERED' WHERE team_id = p_team_id AND deleted_at IS NULL;
        UPDATE events SET registration_count = registration_count + v_team_size WHERE id = p_event_id;
        
        INSERT INTO event_registrations (event_id, user_id, team_id, registration_status)
        VALUES (p_event_id, v_caller_id, p_team_id, 'REGISTERED') RETURNING * INTO v_reg;
        RETURN json_build_object('registration_id', v_reg.id, 'status', 'REGISTERED');
      ELSE
        UPDATE teams SET status = 'WAITLISTED' WHERE id = p_team_id;
        INSERT INTO event_registrations (event_id, user_id, team_id, registration_status)
        VALUES (p_event_id, v_caller_id, p_team_id, 'WAITLISTED') RETURNING * INTO v_reg;
        RETURN json_build_object('registration_id', v_reg.id, 'status', 'WAITLISTED');
      END IF;
    ELSE
      -- Still FORMING
      INSERT INTO event_registrations (event_id, user_id, team_id, registration_status)
      VALUES (p_event_id, v_caller_id, p_team_id, 'WAITLISTED') RETURNING * INTO v_reg;
      RETURN json_build_object('registration_id', v_reg.id, 'status', 'FORMING');
    END IF;
  ELSIF v_team.status = 'REGISTERED' THEN
    UPDATE events SET registration_count = registration_count + 1 WHERE id = p_event_id;
    INSERT INTO event_registrations (event_id, user_id, team_id, registration_status)
    VALUES (p_event_id, v_caller_id, p_team_id, 'REGISTERED') RETURNING * INTO v_reg;
    RETURN json_build_object('registration_id', v_reg.id, 'status', 'REGISTERED');
  ELSE
    -- WAITLISTED
    INSERT INTO event_registrations (event_id, user_id, team_id, registration_status)
    VALUES (p_event_id, v_caller_id, p_team_id, 'WAITLISTED') RETURNING * INTO v_reg;
    RETURN json_build_object('registration_id', v_reg.id, 'status', 'WAITLISTED');
  END IF;
END;
$$;


-- `leave_team` / remove member
CREATE OR REPLACE FUNCTION leave_team(p_event_id UUID, p_team_id UUID, p_user_id UUID)
RETURNS UUID[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID := current_user_id();
  v_reg event_registrations;
  v_team teams;
  v_event events;
  v_promoted UUID[] := ARRAY[]::UUID[];
BEGIN
  IF v_caller_id != p_user_id AND NOT EXISTS (
    SELECT 1 FROM users WHERE id = v_caller_id AND global_role IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN')
  ) THEN
    -- Or club admin, handled by Express middleware before entering RPC
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT * INTO v_event FROM events WHERE id = p_event_id FOR UPDATE;
  IF v_event.is_locked = true THEN RAISE EXCEPTION 'Event is locked'; END IF;

  SELECT * INTO v_team FROM teams WHERE id = p_team_id AND event_id = p_event_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Team not found'; END IF;
  
  IF v_team.leader_id = p_user_id THEN
    RAISE EXCEPTION 'Leader cannot leave without transferring leadership';
  END IF;

  UPDATE event_registrations 
  SET deleted_at = now(), registration_status = 'CANCELLED' 
  WHERE event_id = p_event_id AND team_id = p_team_id AND user_id = p_user_id AND deleted_at IS NULL
  RETURNING * INTO v_reg;
  
  IF NOT FOUND THEN RAISE EXCEPTION 'Registration not found'; END IF;

  IF v_team.status = 'REGISTERED' THEN
    UPDATE events SET registration_count = registration_count - 1 WHERE id = p_event_id;
    -- The Below-minimum condition is derived, no state change here
    v_promoted := process_waitlist(p_event_id);
  END IF;

  RETURN v_promoted;
END;
$$;


-- `transfer_leadership`
CREATE OR REPLACE FUNCTION transfer_leadership(p_event_id UUID, p_team_id UUID, p_new_leader_id UUID)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID := current_user_id();
  v_team teams;
  v_event events;
BEGIN
  IF v_caller_id IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  -- Express middleware handles caller role validation (Leader or Admin)

  SELECT * INTO v_event FROM events WHERE id = p_event_id;
  IF v_event.is_locked = true THEN RAISE EXCEPTION 'Event is locked'; END IF;

  SELECT * INTO v_team FROM teams WHERE id = p_team_id AND event_id = p_event_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Team not found'; END IF;

  -- Ensure new leader is an active member
  PERFORM 1 FROM event_registrations 
  WHERE event_id = p_event_id AND team_id = p_team_id AND user_id = p_new_leader_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'New leader must be an active team member'; END IF;

  UPDATE teams SET leader_id = p_new_leader_id WHERE id = p_team_id;

  RETURN json_build_object('status', 'SUCCESS', 'new_leader_id', p_new_leader_id);
END;
$$;


-- `cancel_team`
CREATE OR REPLACE FUNCTION cancel_team(p_event_id UUID, p_team_id UUID)
RETURNS UUID[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_team teams;
  v_event events;
  v_member_count INT;
  v_promoted UUID[] := ARRAY[]::UUID[];
BEGIN
  -- Express middleware handles caller authorization (Leader as last member or Admin)
  SELECT * INTO v_event FROM events WHERE id = p_event_id FOR UPDATE;
  IF v_event.is_locked = true THEN RAISE EXCEPTION 'Event is locked'; END IF;

  SELECT * INTO v_team FROM teams WHERE id = p_team_id AND event_id = p_event_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Team not found'; END IF;

  SELECT count(*) INTO v_member_count FROM event_registrations WHERE team_id = p_team_id AND deleted_at IS NULL;

  UPDATE teams SET status = 'CANCELLED', deleted_at = now() WHERE id = p_team_id;
  
  UPDATE event_registrations 
  SET deleted_at = now(), registration_status = 'CANCELLED' 
  WHERE team_id = p_team_id AND deleted_at IS NULL;

  IF v_team.status = 'REGISTERED' THEN
    UPDATE events SET registration_count = registration_count - v_member_count WHERE id = p_event_id;
    v_promoted := process_waitlist(p_event_id);
  END IF;

  RETURN v_promoted;
END;
$$;
