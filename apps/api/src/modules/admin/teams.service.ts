import { withUserContext } from '@nst/database';
import { enqueueNotification } from '../notifications/notifications.producer';
import { prisma } from '../../lib/prisma';
import { NotFoundError, BadRequestError } from '../../lib/errors';
import { checkAudienceEligibility } from '../events/audience.service';
import * as teamsService from '../teams/teams.service';
import { mapDatabaseError } from '../../lib/errors/database-error-mapper';

const checkEventLock = (event: any) => {
  const isLocked = event.isLocked || new Date() >= new Date(event.endTime.getTime() + 24 * 60 * 60 * 1000);
  if (isLocked) throw new BadRequestError('Event is locked');
};

export const manualWaitlistPromotion = async (userId: string, teamId: string) => {
  return withUserContext(userId, async (tx) => {
    const team = await tx.team.findUnique({ where: { id: teamId } });
    if (!team) throw new NotFoundError('Team not found');
    
    try {
      await tx.$queryRaw`SELECT manual_promote_team(${teamId}::uuid)`;
    } catch (err: any) {
      mapDatabaseError(err);
      throw err;
    }

    await tx.auditLog.create({
      data: {
        action: 'TEAM_WAITLIST_OVERRIDE',
        entityType: 'TEAM',
        entityId: teamId,
        actorId: userId,
        
        newState: { team_id: teamId }
      }
    });

    const members = await tx.eventRegistration.findMany({
      where: { teamId, deletedAt: null },
      select: { userId: true }
    });

    for (const member of members) {
      await enqueueNotification({
        tx,
        userId: member.userId,
        type: 'WAITLIST_PROMOTED',
        title: 'You are off the waitlist!',
        body: 'A spot opened up and your team is now registered.',
        metadata: {
          schema_version: 1,
          routing: { target: 'event_details', fallback: '/events', params: { id: team.eventId } },
          entity_ids: { event_id: team.eventId }
        },
        preferenceGate: 'push_enabled',
        idempotencyString: `WAITLIST_PROMOTED:${member.userId}:${team.eventId}`
      });
    }

    return { status: 'REGISTERED' };
  });
};

export const cancelTeam = async (userId: string, teamId: string) => {
  return withUserContext(userId, async (tx) => {
    const team = await tx.team.findUnique({ where: { id: teamId }, include: { event: true } });
    if (!team) throw new NotFoundError('Team not found');

    let result;
    try {
      result = await tx.$queryRaw<{ cancel_team: string[] }[]>`
        SELECT cancel_team(${team.eventId}::uuid, ${teamId}::uuid);
      `;
    } catch (err) {
      mapDatabaseError(err);
      throw err;
    }
    if (!result || result.length === 0) throw new BadRequestError('Failed to cancel team');

    await tx.auditLog.create({
      data: {
        action: 'TEAM_CANCELLED',
        entityType: 'TEAM',
        entityId: teamId,
        actorId: userId,
        
        newState: { team_id: teamId }
      }
    });

    await enqueueNotification({
      tx, userId: team.leaderId, type: 'TEAM_CANCELLED', title: 'Team Cancelled', body: 'Your team has been cancelled by an administrator.',
      metadata: { schema_version: 1, routing: { target: 'event_details', fallback: '/events', params: { id: team.eventId } }, entity_ids: { event_id: team.eventId } },
      preferenceGate: 'push_enabled', idempotencyString: `TEAM_CANCEL_ADMIN:${teamId}`
    });

    const promotedUserIds = result[0].cancel_team;
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
    return { status: 'CANCELLED' };
  });
};

export const removeMember = async (userId: string, teamId: string, targetUserId: string) => {
  return withUserContext(userId, async (tx) => {
    const team = await tx.team.findUnique({ where: { id: teamId }, include: { event: true } });
    if (!team) throw new NotFoundError('Team not found');

    if (team.leaderId === targetUserId) {
      throw new BadRequestError('Cannot remove leader. Transfer leadership first.');
    }

    let result;
    try {
      result = await tx.$queryRaw<{ leave_team: string[] }[]>`
        SELECT leave_team(${team.eventId}::uuid, ${teamId}::uuid, ${targetUserId}::uuid);
      `;
    } catch (err) {
      mapDatabaseError(err);
      throw err;
    }

    await tx.auditLog.create({
      data: {
        action: 'TEAM_MEMBER_REMOVED',
        entityType: 'TEAM',
        entityId: teamId,
        actorId: userId,
        
        newState: { team_id: teamId, removed_user_id: targetUserId }
      }
    });

    const promotedUserIds = result[0].leave_team;
    if (promotedUserIds && promotedUserIds.length > 0) {
      for (const uid of promotedUserIds) {
        await enqueueNotification({
          tx, userId: uid, type: 'TEAM_WAITLIST_PROMOTED', title: 'Team Registered!', body: 'A spot opened up and your team is now registered.',
          metadata: { schema_version: 1, routing: { target: 'event_details', fallback: '/events', params: { id: team.eventId } }, entity_ids: { event_id: team.eventId } },
          preferenceGate: 'push_enabled', idempotencyString: `TEAM_WAIT_PROM_ADMIN:${team.eventId}:${uid}`
        });
      }
    }
  });
};

export const transferLeadership = async (userId: string, teamId: string, newLeaderId: string) => {
  return withUserContext(userId, async (tx) => {
    const team = await tx.team.findUnique({ where: { id: teamId }, include: { event: true } });
    if (!team) throw new NotFoundError('Team not found');
    checkEventLock(team.event);
    
    await checkAudienceEligibility(team.eventId, newLeaderId, tx);

    let result;
    try {
      result = await tx.$queryRaw<{ transfer_leadership: any }[]>`
        SELECT transfer_leadership(${team.eventId}::uuid, ${teamId}::uuid, ${newLeaderId}::uuid);
      `;
    } catch (err) {
      mapDatabaseError(err);
      throw err;
    }
    if (!result || result.length === 0) throw new BadRequestError('Failed to transfer leadership');

    await tx.auditLog.create({
      data: {
        action: 'TEAM_LEAD_TRANSFERRED',
        entityType: 'TEAM',
        entityId: teamId,
        actorId: userId,
        
        newState: { team_id: teamId, new_leader_id: newLeaderId }
      }
    });

    return result[0].transfer_leadership;
  });
};

export const getSentTeamInvitations = async (userId: string, teamId: string) => {
  return withUserContext(userId, async (tx) => {
    const team = await tx.team.findUnique({ where: { id: teamId } });
    if (!team) throw new NotFoundError('Team not found');

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

export const cancelInvitation = async (userId: string, teamId: string, invitationId: string) => {
  return withUserContext(userId, async (tx) => {
    const team = await tx.team.findUnique({ where: { id: teamId }, include: { event: true } });
    if (!team) throw new NotFoundError('Team not found');

    const dbTimeResult = await tx.$queryRaw<{ now: Date }[]>`SELECT now() as now`;
    const dbNow = dbTimeResult[0].now;
    const finalDeadline = new Date(team.event.endTime.getTime() + 24 * 60 * 60 * 1000);
    if (team.event.isLocked || dbNow >= finalDeadline) {
      throw new BadRequestError('Event is locked');
    }

    const inv = await tx.teamInvitation.findFirst({
      where: { id: invitationId, teamId }
    });
    
    if (!inv) throw new NotFoundError('Invitation not found');
    
    if (inv.status !== 'PENDING') {
      throw new BadRequestError('INVITATION_NOT_CANCELLABLE');
    }
    
    if (inv.expiresAt < new Date()) {
      await tx.teamInvitation.update({ where: { id: inv.id }, data: { status: 'EXPIRED' } });
      throw new BadRequestError('INVITATION_NOT_CANCELLABLE');
    }

    await tx.teamInvitation.update({
      where: { id: invitationId },
      data: { status: 'CANCELLED', respondedAt: new Date() }
    });
    
    await tx.auditLog.create({
      data: {
        action: 'TEAM_INVITATION_CANCELLED_ADMIN',
        entityType: 'TEAM',
        entityId: teamId,
        actorId: userId,
        newState: { team_id: teamId, invitation_id: invitationId }
      }
    });
  });
};
