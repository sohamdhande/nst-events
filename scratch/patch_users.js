const fs = require('fs');
const path = 'apps/api/src/modules/users/users.service.ts';
let code = fs.readFileSync(path, 'utf-8');

code = code.replace(
  /const invitations = await (tx|prisma)\.teamInvitation\.findMany\(\{[\s\S]*?\}\);\s*return invitations\.map\(\(inv\) => \(\{[\s\S]*?\}\)\);\s*\S+\s*\S+;/,
`const invitations = await tx.teamInvitation.findMany({
      where: {
        inviteeId: userId,
        status: 'PENDING',
        expiresAt: { gte: new Date() }
      },
      include: {
        team: {
          include: {
            event: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const leaderIds = Array.from(new Set(invitations.map((inv: any) => inv.team.leaderId)));
    const profiles = await tx.publicProfile.findMany({
      where: { id: { in: leaderIds } },
      select: { id: true, fullName: true }
    });
    const profileMap = new Map(profiles.map((p: any) => [p.id, p]));

    return invitations.map((inv: any) => ({
      invitation_id: inv.id,
      status: inv.status,
      created_at: inv.createdAt,
      expires_at: inv.expiresAt,
      team: {
        team_id: inv.team.id,
        team_name: inv.team.name,
        leader: profileMap.get(inv.team.leaderId)?.fullName || 'Unknown'
      },
      event: {
        event_id: inv.team.event.id,
        event_title: inv.team.event.title
      }
    }));
  });
};`
);
fs.writeFileSync(path, code);
