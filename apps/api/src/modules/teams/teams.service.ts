import { withUserContext } from '@nst/database';
import { enqueueNotification } from '../notifications/notifications.producer';
import { prisma } from '../../lib/prisma';
import { NotFoundError, BadRequestError, ForbiddenError } from '../../lib/errors';
import { checkAudienceEligibility } from '../events/audience.service';

const checkEventLock = (event: any) => {
  const isLocked = event.isLocked || new Date() >= new Date(event.endTime.getTime() + 24 * 60 * 60 * 1000);
  if (isLocked) throw new BadRequestError('Event is locked');
};

export const listTeams = async (userId: string, eventId: string, limit: number = 50, cursor?: string) => {
  return withUserContext(userId, async (tx) => {
    const take = limit + 1;
    const teams = await tx.team.findMany({
      where: {
        eventId,
        deletedAt: null,
      },
      take,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      include: {
        leader: { select: { fullName: true } },
        event: { select: { metadata: true } },
        eventRegistrations: {
          where: { deletedAt: null },
          select: {
            userId: true,
            registrationStatus: true,
            user: { select: { fullName: true } }
          }
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    let nextCursor: string | undefined = undefined;
    if (teams.length > limit) {
      const nextItem = teams.pop();
      nextCursor = nextItem!.id;
    }

    const data = teams.map((t) => {
      let below_minimum = false;
      const metadata = t.event.metadata as any;
      if (t.status === 'REGISTERED' && metadata && typeof metadata.minimum_team_size === 'number') {
        below_minimum = t.eventRegistrations.length < metadata.minimum_team_size;
      }

      return {
        id: t.id,
        name: t.name,
        leader_id: t.leaderId,
        status: t.status,
        below_minimum,
        leader_name: t.leader?.fullName || 'Unknown',
        member_count: t.eventRegistrations.length,
        members: t.eventRegistrations.map((m) => ({
          user_id: m.userId,
          full_name: m.user?.fullName || 'Unknown',
          registration_status: m.registrationStatus
        }))
      };
    });

    return { data, pagination: { nextCursor } };
  });
};

export const createTeam = async (userId: string, eventId: string, teamName: string) => {
  return withUserContext(userId, async (tx) => {
    try {
      await checkAudienceEligibility(eventId, userId, tx);

      const result = await tx.$queryRaw<{ create_team: any }[]>`
        SELECT create_team(${eventId}::uuid, ${teamName});
      `;
      const createResult = result[0].create_team;
      return { team_id: createResult.team_id, name: teamName, leader_id: userId, status: createResult.status, registration_id: createResult.registration_id };
    } catch (err: any) {
      if (err.message?.includes('Event capacity is full')) {
        throw new BadRequestError('Event capacity is full.');
      }
      if (err.message?.includes('Event is locked')) {
        throw new BadRequestError('Event is locked.');
      }
      if (err.message?.includes('Already in a team')) {
        throw new BadRequestError('Already in a team for this event.');
      }
      throw err;
    }
  });
};

export const joinTeam = async (userId: string, teamId: string) => {
  return withUserContext(userId, async (tx) => {
    const team = await tx.team.findUnique({ where: { id: teamId } });
    if (!team) throw new NotFoundError('Team not found');

    await checkAudienceEligibility(team.eventId, userId, tx);

    try {
      const result = await tx.$queryRaw<{ join_team: any }[]>`
        SELECT join_team(${team.eventId}::uuid, ${teamId}::uuid);
      `;
      const joinResult = result[0].join_team;

      if (joinResult.status === 'REGISTERED') {
        await enqueueNotification({
          tx, userId, type: 'TEAM_REGISTERED', title: 'Team Registered', body: 'Your team is now registered.',
          metadata: { schema_version: 1, routing: { target: 'event_details', fallback: '/events', params: { id: team.eventId } }, entity_ids: { event_id: team.eventId } },
          preferenceGate: 'push_enabled', idempotencyString: `TEAM_REGISTERED:${joinResult.registration_id}`
        });
      } else if (joinResult.status === 'WAITLISTED') {
        await enqueueNotification({
          tx, userId, type: 'TEAM_WAITLISTED', title: 'Team Waitlisted', body: 'Your team has been waitlisted.',
          metadata: { schema_version: 1, routing: { target: 'event_details', fallback: '/events', params: { id: team.eventId } }, entity_ids: { event_id: team.eventId } },
          preferenceGate: 'push_enabled', idempotencyString: `TEAM_WAITLISTED:${joinResult.registration_id}`
        });
      }

      return joinResult;
    } catch (err: any) {
      if (err.message?.includes('Team is full')) {
        throw new BadRequestError('Team is full');
      }
      throw err;
    }
  });
};

export const leaveTeam = async (userId: string, teamId: string) => {
  return withUserContext(userId, async (tx) => {
    const team = await tx.team.findUnique({ where: { id: teamId } });
    if (!team) throw new NotFoundError('Team not found');

    try {
      const result = await tx.$queryRaw<{ leave_team: string[] }[]>`
        SELECT leave_team(${team.eventId}::uuid, ${teamId}::uuid, ${userId}::uuid);
      `;

      const promotedUserIds = result[0].leave_team;
      if (promotedUserIds && promotedUserIds.length > 0) {
        for (const uid of promotedUserIds) {
          await enqueueNotification({
            tx,
            userId: uid,
            type: 'WAITLIST_PROMOTED',
            title: 'You are off the waitlist!',
            body: 'A spot opened up and your team is now registered.',
            metadata: {
              schema_version: 1,
              routing: { target: 'event_details', fallback: '/events', params: { id: team.eventId } },
              entity_ids: { event_id: team.eventId }
            },
            preferenceGate: 'push_enabled',
            idempotencyString: `WAITLIST_PROMOTED:${uid}:${team.eventId}`
          });
        }
      }
      return promotedUserIds;
    } catch (err: any) {
      if (err.message?.includes('Leader cannot leave without transferring leadership')) {
        throw new BadRequestError('Leader cannot leave without transferring leadership');
      }
      throw err;
    }
  });
};

export const getSentTeamInvitations = async (userId: string, eventId: string, teamId: string) => {
  return withUserContext(userId, async (tx) => {
    const team = await tx.team.findUnique({ where: { id: teamId } });
    if (!team || team.eventId !== eventId) throw new NotFoundError('Team not found for this event');
    
    // Ensure caller is the leader or has management roles via the router's middleware
    if (team.leaderId !== userId) {
      throw new ForbiddenError('Only the team leader can view sent invitations');
    }

    // Expire old ones cleanly inline
    await tx.teamInvitation.updateMany({
      where: {
        teamId,
        status: 'PENDING',
        expiresAt: { lt: new Date() }
      },
      data: { status: 'EXPIRED' }
    });

    const invitations = await tx.teamInvitation.findMany({
      where: { teamId },
      orderBy: { createdAt: 'desc' }
    });

    if (invitations.length === 0) return [];

    const inviteeIds = invitations.map((inv: any) => inv.inviteeId);
    const publicProfiles = await tx.publicProfile.findMany({
      where: { id: { in: inviteeIds } },
      select: { id: true, fullName: true, avatarUrl: true }
    });
    
    const profileMap = new Map(publicProfiles.map((p: any) => [p.id, p]));

    return invitations.map((inv: any) => {
      const profile = profileMap.get(inv.inviteeId);
      return {
        invitation_id: inv.id,
        status: inv.status,
        created_at: inv.createdAt,
        expires_at: inv.expiresAt,
        invitee: profile ? {
          user_id: profile.id,
          display_name: profile.fullName,
          avatar_url: profile.avatarUrl
        } : null
      };
    });
  });
};

export const inviteMember = async (userId: string, teamId: string, inviteeId: string) => {
  return withUserContext(userId, async (tx) => {
    const team = await tx.team.findUnique({ where: { id: teamId }, include: { event: true } });
    if (!team) throw new NotFoundError('Team not found');
    if (team.leaderId !== userId) throw new BadRequestError('Only the leader can invite members');
    checkEventLock(team.event);
    if (team.status === 'CANCELLED') throw new BadRequestError('Team is cancelled');

    const activeMembersCount = await tx.eventRegistration.count({
      where: { teamId, deletedAt: null }
    });
    const maxSize = team.event.metadata ? (team.event.metadata as any).maximum_team_size : null;
    if (maxSize && activeMembersCount >= maxSize) throw new BadRequestError('Team is full');

    // Check invitee not already in a team
    const existingReg = await tx.eventRegistration.findFirst({
      where: { eventId: team.eventId, userId: inviteeId, deletedAt: null }
    });
    if (existingReg) throw new BadRequestError('User already in a team');

    // Check no duplicate pending invitation
    const existingInv = await tx.teamInvitation.findFirst({
      where: { teamId, inviteeId, status: 'PENDING' }
    });
    if (existingInv) {
      if (existingInv.expiresAt > new Date()) {
        throw new BadRequestError('A pending invitation already exists');
      } else {
        // Expired, mark as EXPIRED
        await tx.teamInvitation.update({ where: { id: existingInv.id }, data: { status: 'EXPIRED' } });
      }
    }

    await checkAudienceEligibility(team.eventId, inviteeId, tx);

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 72);

    const invitation = await tx.teamInvitation.create({
      data: {
        teamId,
        inviteeId,
        status: 'PENDING',
        expiresAt
      }
    });

    await enqueueNotification({
      tx,
      userId: inviteeId,
      type: 'TEAM_INVITATION_RECEIVED',
      title: 'Team Invitation',
      body: `You have been invited to join team ${team.name}.`,
      metadata: {
        schema_version: 1,
        routing: { target: 'event_details', fallback: '/events', params: { id: team.eventId } },
        entity_ids: { event_id: team.eventId, team_id: teamId, invitation_id: invitation.id }
      },
      preferenceGate: 'push_enabled',
      idempotencyString: `TEAM_INVITATION:${invitation.id}`
    });

    return invitation;
  });
};

export const acceptInvitation = async (userId: string, teamId: string, invitationId: string) => {
  return withUserContext(userId, async (tx) => {
    try {
      const team = await tx.team.findUnique({ where: { id: teamId } });
      if (!team) throw new NotFoundError('Team not found');
      await checkAudienceEligibility(team.eventId, userId, tx);

      const result = await tx.$queryRaw<{ accept_invitation: any }[]>`
        SELECT accept_invitation(${team.eventId}::uuid, ${teamId}::uuid, ${invitationId}::uuid);
      `;
      const acceptResult = result[0].accept_invitation;

      await enqueueNotification({
        tx, userId: team.leaderId, type: 'TEAM_INVITATION_ACCEPTED', title: 'Invitation Accepted', body: 'A member accepted your team invitation.',
        metadata: { schema_version: 1, routing: { target: 'event_details', fallback: '/events', params: { id: team.eventId } }, entity_ids: { event_id: team.eventId } },
        preferenceGate: 'push_enabled', idempotencyString: `TEAM_INV_ACCEPT:${invitationId}`
      });

      if (acceptResult.status === 'REGISTERED') {
        const teamMembers = await tx.eventRegistration.findMany({ where: { teamId, deletedAt: null }});
        for (const m of teamMembers) {
          await enqueueNotification({
            tx, userId: m.userId, type: 'TEAM_REGISTERED', title: 'Team Registered', body: 'Your team is now registered.',
            metadata: { schema_version: 1, routing: { target: 'event_details', fallback: '/events', params: { id: team.eventId } }, entity_ids: { event_id: team.eventId } },
            preferenceGate: 'push_enabled', idempotencyString: `TEAM_REG:${teamId}:${m.userId}`
          });
        }
      } else if (acceptResult.status === 'WAITLISTED') {
        const teamMembers = await tx.eventRegistration.findMany({ where: { teamId, deletedAt: null }});
        for (const m of teamMembers) {
          await enqueueNotification({
            tx, userId: m.userId, type: 'TEAM_WAITLISTED', title: 'Team Waitlisted', body: 'Your team has been waitlisted.',
            metadata: { schema_version: 1, routing: { target: 'event_details', fallback: '/events', params: { id: team.eventId } }, entity_ids: { event_id: team.eventId } },
            preferenceGate: 'push_enabled', idempotencyString: `TEAM_WAIT:${teamId}:${m.userId}`
          });
        }
      }

      return acceptResult;
    } catch (err: any) {
      if (err.message?.includes('Invitation expired')) {
        throw new BadRequestError('Invitation expired');
      }
      throw err;
    }
  });
};

export const declineInvitation = async (userId: string, teamId: string, invitationId: string) => {
  return withUserContext(userId, async (tx) => {
    const inv = await tx.teamInvitation.findFirst({
      where: { id: invitationId, teamId, inviteeId: userId, status: 'PENDING' },
      include: { team: { include: { event: true } } }
    });
    if (!inv) throw new NotFoundError('Invitation not found or invalid');
    checkEventLock(inv.team.event);
    if (inv.expiresAt < new Date()) {
      await tx.teamInvitation.update({ where: { id: inv.id }, data: { status: 'EXPIRED' } });
      throw new BadRequestError('Invitation expired');
    }

    await tx.teamInvitation.update({
      where: { id: invitationId },
      data: { status: 'DECLINED', respondedAt: new Date() }
    });

    await enqueueNotification({
      tx, userId: inv.team.leaderId, type: 'TEAM_INVITATION_DECLINED', title: 'Invitation Declined', body: 'A member declined your team invitation.',
      metadata: { schema_version: 1, routing: { target: 'event_details', fallback: '/events', params: { id: inv.team.eventId } }, entity_ids: { event_id: inv.team.eventId } },
      preferenceGate: 'push_enabled', idempotencyString: `TEAM_INV_DEC:${invitationId}`
    });

    return { status: 'DECLINED' };
  });
};

export const cancelInvitation = async (userId: string, teamId: string, invitationId: string) => {
  return withUserContext(userId, async (tx) => {
    const team = await tx.team.findUnique({ where: { id: teamId }, include: { event: true } });
    if (!team) throw new NotFoundError('Team not found');
    if (team.leaderId !== userId) throw new BadRequestError('Only the leader can cancel invitations');
    checkEventLock(team.event);

    const inv = await tx.teamInvitation.findFirst({
      where: { id: invitationId, teamId, status: 'PENDING' }
    });
    if (!inv) throw new NotFoundError('Invitation not found or invalid');

    await tx.teamInvitation.update({
      where: { id: invitationId },
      data: { status: 'CANCELLED', respondedAt: new Date() }
    });
  });
};

export const transferLeadership = async (userId: string, teamId: string, newLeaderId: string) => {
  return withUserContext(userId, async (tx) => {
    const team = await tx.team.findUnique({ where: { id: teamId } });
    if (!team) throw new NotFoundError('Team not found');
    if (team.leaderId !== userId) throw new BadRequestError('Only the leader can transfer leadership');

    const result = await tx.$queryRaw<{ transfer_leadership: any }[]>`
      SELECT transfer_leadership(${team.eventId}::uuid, ${teamId}::uuid, ${newLeaderId}::uuid);
    `;

    await enqueueNotification({
      tx, userId: newLeaderId, type: 'TEAM_LEADERSHIP_TRANSFERRED', title: 'Leadership Transferred', body: 'You are now the leader of your team.',
      metadata: { schema_version: 1, routing: { target: 'event_details', fallback: '/events', params: { id: team.eventId } }, entity_ids: { event_id: team.eventId } },
      preferenceGate: 'push_enabled', idempotencyString: `TEAM_LEAD_TRANS:${teamId}:${newLeaderId}`
    });

    return result[0].transfer_leadership;
  });
};

export const removeMember = async (userId: string, teamId: string, targetUserId: string) => {
  return withUserContext(userId, async (tx) => {
    const team = await tx.team.findUnique({ where: { id: teamId } });
    if (!team) throw new NotFoundError('Team not found');
    if (team.leaderId !== userId) throw new BadRequestError('Only the leader can remove members');

    const result = await tx.$queryRaw<{ leave_team: string[] }[]>`
      SELECT leave_team(${team.eventId}::uuid, ${teamId}::uuid, ${targetUserId}::uuid);
    `;

    await enqueueNotification({
      tx, userId: targetUserId, type: 'TEAM_MEMBER_REMOVED', title: 'Removed from Team', body: 'You have been removed from your team.',
      metadata: { schema_version: 1, routing: { target: 'event_details', fallback: '/events', params: { id: team.eventId } }, entity_ids: { event_id: team.eventId } },
      preferenceGate: 'push_enabled', idempotencyString: `TEAM_MEM_REM:${teamId}:${targetUserId}`
    });

    // Process waitlist promotion notifications
    const promotedUserIds = result[0].leave_team;
    if (promotedUserIds && promotedUserIds.length > 0) {
      for (const uid of promotedUserIds) {
        await enqueueNotification({
          tx, userId: uid, type: 'TEAM_WAITLIST_PROMOTED', title: 'Team Registered!', body: 'A spot opened up and your team is now registered.',
          metadata: { schema_version: 1, routing: { target: 'event_details', fallback: '/events', params: { id: team.eventId } }, entity_ids: { event_id: team.eventId } },
          preferenceGate: 'push_enabled', idempotencyString: `TEAM_WAIT_PROM:${team.eventId}:${uid}`
        });
      }
    }
  });
};
