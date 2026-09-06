// Proposed logic
const hasTeam = event.registrationType === 'TEAM' && registration?.team_id;

// in renderRegistrationAction:
if (hasTeam) {
   // Top right CTA: "View Team" ? Or null?
   // If status is REGISTERED/WAITLISTED/CANCELLED, it returns null anyway.
   // But what if status is NOT_REGISTERED but they have a team_id? (e.g. FORMING)
   // We should probably return null if they have a team, so the action is just in the right rail.
}
