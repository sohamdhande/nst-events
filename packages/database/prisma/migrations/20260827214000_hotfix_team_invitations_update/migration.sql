-- Hotfix: Allow Club Admins and Platform Admins to update team invitations (needed for cancellation)

DROP POLICY IF EXISTS "Allow UPDATE on team_invitations" ON "team_invitations";

CREATE POLICY "Allow UPDATE on team_invitations" ON "team_invitations"
FOR UPDATE TO nst_app USING (
  invitee_id = current_user_id() OR
  EXISTS (SELECT 1 FROM teams WHERE teams.id = team_invitations.team_id AND teams.leader_id = current_user_id()) OR
  EXISTS (SELECT 1 FROM teams t JOIN event_clubs ec ON t.event_id = ec.event_id WHERE t.id = team_invitations.team_id AND has_club_role(ec.club_id, current_user_id(), ARRAY['CLUB_ADMIN'::text, 'FACULTY_MENTOR'::text])) OR
  current_user_global_role() = ANY(ARRAY['PLATFORM_ADMIN', 'FACULTY_ADMIN'])
) WITH CHECK (
  invitee_id = current_user_id() OR
  EXISTS (SELECT 1 FROM teams WHERE teams.id = team_invitations.team_id AND teams.leader_id = current_user_id()) OR
  EXISTS (SELECT 1 FROM teams t JOIN event_clubs ec ON t.event_id = ec.event_id WHERE t.id = team_invitations.team_id AND has_club_role(ec.club_id, current_user_id(), ARRAY['CLUB_ADMIN'::text, 'FACULTY_MENTOR'::text])) OR
  current_user_global_role() = ANY(ARRAY['PLATFORM_ADMIN', 'FACULTY_ADMIN'])
);
