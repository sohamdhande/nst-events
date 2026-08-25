import * as fs from 'fs';
const path = 'apps/api/src/modules/registrations/registrations.service.ts';
let code = fs.readFileSync(path, 'utf-8');

code = code.replace(
  /export const searchEligibleInvitees = async \(userId: string, eventId: string, q: string\) => {[\s\S]*?^};/m,
`export const searchEligibleInvitees = async (userId: string, eventId: string, q: string) => {
  return withUserContext(userId, async (tx) => {
    // 1. Verify caller is a leader of an active team for this event.
    const callerTeam = await tx.team.findFirst({
      where: { eventId, leaderId: userId, deletedAt: null },
      include: { event: true, eventRegistrations: { where: { deletedAt: null } } }
    });

    if (!callerTeam) {
      throw new ForbiddenError('Only the team leader can search for invitees');
    }
    
    const event = callerTeam.event;
    if (!event || event.state !== 'PUBLISHED') throw new BadRequestError('Event not available');
    
    // Check event lock
    const now = new Date();
    const lockTime = new Date(event.endTime);
    lockTime.setHours(lockTime.getHours() + 24);
    if (event.isLocked || now >= lockTime) {
      throw new BadRequestError('EVENT_LOCKED');
    }

    // Check if team is at max capacity
    const metadata = event.metadata as Record<string, any> | null;
    const maxTeamSize = metadata?.maximum_team_size as number | undefined;
    if (maxTeamSize && callerTeam.eventRegistrations.length >= maxTeamSize) {
      throw new BadRequestError('TEAM_MAXIMUM_REACHED');
    }

    // 2. Exclude caller and current team members
    const memberIds = callerTeam.eventRegistrations.map((m: any) => m.userId);
    memberIds.push(userId); // just in case

    // Exclude users already registered for THIS event
    const existingRegistrations = await tx.eventRegistration.findMany({
      where: { eventId, deletedAt: null },
      select: { userId: true }
    });
    const registeredUserIds = existingRegistrations.map(r => r.userId);

    // Exclude users with pending invitations for THIS event
    const pendingInvitations = await tx.teamInvitation.findMany({
      where: { 
        status: 'PENDING', 
        expiresAt: { gt: new Date() },
        team: { eventId, deletedAt: null }
      },
      select: { inviteeId: true }
    });
    const pendingInviteeIds = pendingInvitations.map(i => i.inviteeId);

    const excludeIds = new Set([...memberIds, ...registeredUserIds, ...pendingInviteeIds]);

    // 3. Base query: search fullName in PublicProfile
    const profiles = await tx.publicProfile.findMany({
      where: {
        deletedAt: null,
        id: { notIn: Array.from(excludeIds) },
        fullName: { contains: q, mode: 'insensitive' }
      },
      select: {
        id: true,
        fullName: true,
        avatarUrl: true
      },
      take: 20,
      orderBy: { fullName: 'asc' }
    });

    let eligibleProfiles = profiles;

    // 4. Audience eligibility filter
    if (event.audience === 'SPECIFIC_BATCHES') {
      const validBatches = await tx.eventAudienceBatch.findMany({
        where: { eventId },
        select: { batchId: true }
      });
      const batchIds = validBatches.map(b => b.batchId);
      
      const academicProfiles = await tx.userAcademicProfile.findMany({
        where: {
          userId: { in: profiles.map(p => p.id) },
          batchId: { in: batchIds }
        },
        select: { userId: true }
      });
      
      const eligibleIds = new Set(academicProfiles.map(a => a.userId));
      eligibleProfiles = profiles.filter(p => eligibleIds.has(p.id));
    }

    // 5. Return top 10
    return eligibleProfiles.slice(0, 10).map(u => ({
      user_id: u.id,
      display_name: u.fullName,
      institutional_email: '', // Cannot expose email per rules
      avatar_url: u.avatarUrl
    }));
  });
};`
);
fs.writeFileSync(path, code);
