import { withUserContext } from '@nst/database';
import { prisma } from '../../lib/prisma';

export const getMe = async (userId: string) => {
  return withUserContext(userId, async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        avatarUrl: true,
        globalRole: true,
        clubMemberships: {
          where: { deletedAt: null },
          select: {
            clubId: true,
            role: true,
            club: {
              select: {
                name: true,
              },
            },
          },
        },
        academicProfile: {
          select: {
            assignmentSource: true,
            batch: {
              select: {
                id: true,
                admissionYear: true,
                graduationYear: true,
                program: {
                  select: {
                    id: true,
                    name: true,
                    code: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!user) return null;

    return {
      id: user.id,
      email: user.email,
      full_name: user.fullName,
      avatar_url: user.avatarUrl,
      global_role: user.globalRole,
      club_memberships: user.clubMemberships.map((m) => ({
        club_id: m.clubId,
        club_name: m.club.name,
        role: m.role,
      })),
      academic_profile: user.academicProfile
        ? {
            batch: {
              id: user.academicProfile.batch.id,
              program: {
                id: user.academicProfile.batch.program.id,
                name: user.academicProfile.batch.program.name,
                code: user.academicProfile.batch.program.code,
              },
              admission_year: user.academicProfile.batch.admissionYear,
              graduation_year: user.academicProfile.batch.graduationYear,
            },
            assignment_source: user.academicProfile.assignmentSource,
          }
        : null,
    };
  });
};

export const updateMe = async (userId: string, data: { full_name?: string }) => {
  return withUserContext(userId, async (tx) => {
    const user = await tx.user.update({
      where: { id: userId },
      data: {
        ...(data.full_name && { fullName: data.full_name }),
      },
      select: {
        id: true,
        email: true,
        fullName: true,
      },
    });

    return {
      id: user.id,
      email: user.email,
      full_name: user.fullName,
    };
  });
};

export const getPublicProfile = async (callerId: string, profileId: string) => {
  return withUserContext(callerId, async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: profileId },
      select: {
        id: true,
        fullName: true,
        avatarUrl: true,
        clubMemberships: {
          where: { deletedAt: null },
          select: {
            clubId: true,
            role: true,
            club: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    if (!user) return null;

    return {
      id: user.id,
      full_name: user.fullName,
      avatar_url: user.avatarUrl,
      club_memberships: user.clubMemberships.map((m) => ({
        club_id: m.clubId,
        club_name: m.club.name,
        role: m.role,
      })),
    };
  });
};

export const registerPushToken = async (
  userId: string,
  data: { device_id: string; expo_token: string; platform: string }
) => {
  return withUserContext(userId, async (tx) => {
    const token = await tx.pushToken.upsert({
      where: {
        deviceId: data.device_id,
      },
      update: {
        userId,
        expoToken: data.expo_token,
        platform: data.platform,
        lastSeenAt: new Date(),
      },
      create: {
        userId,
        deviceId: data.device_id,
        expoToken: data.expo_token,
        platform: data.platform,
        lastSeenAt: new Date(),
      },
    });

    return {
      device_id: token.deviceId,
      expo_token: token.expoToken,
      platform: token.platform,
    };
  });
};

export const getPendingTeamInvitations = async (userId: string) => {
  return withUserContext(userId, async (tx) => {
    await tx.teamInvitation.updateMany({
      where: {
        inviteeId: userId,
        status: 'PENDING',
        expiresAt: { lt: new Date() }
      },
      data: { status: 'EXPIRED' }
    });

    const invitations = await tx.teamInvitation.findMany({
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
};
