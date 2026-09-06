import { withUserContext } from '@nst/database';
import { enqueueNotification } from '../notifications/notifications.producer';
import { prisma } from '../../lib/prisma';
import { NotFoundError, BadRequestError, ForbiddenError } from '../../lib/errors';
import { checkAudienceEligibility } from '../events/audience.service';
import { mapDatabaseError } from '../../lib/errors/database-error-mapper';



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

export const getTeamById = async (userId: string, teamId: string) => {
  return withUserContext(userId, async (tx) => {
    const team = await tx.team.findUnique({
      where: { id: teamId, deletedAt: null },
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
      }
    });

    if (!team) {
      throw new NotFoundError('Team not found');
    }

    let below_minimum = false;
    const metadata = team.event.metadata as any;
    if (team.status === 'REGISTERED' && metadata && typeof metadata.minimum_team_size === 'number') {
      below_minimum = team.eventRegistrations.length < metadata.minimum_team_size;
    }

    return {
      id: team.id,
      event_id: team.eventId,
      name: team.name,
      leader_id: team.leaderId,
      status: team.status,
      below_minimum,
      leader_name: team.leader?.fullName || 'Unknown',
      member_count: team.eventRegistrations.length,
      members: team.eventRegistrations.map((m) => ({
        user_id: m.userId,
        full_name: m.user?.fullName || 'Unknown',
        registration_status: m.registrationStatus
      }))
    };
  });
};

export const createTeam = async (userId: string, eventId: string, teamName: string) => {
  return withUserContext(userId, async (tx) => {
    try {
      const result = await tx.$queryRaw<{ create_team: any }[]>`
        SELECT create_team(${eventId}::uuid, ${teamName});
      `;
      const createResult = result[0].create_team;
      return { team_id: createResult.team_id, name: teamName, leader_id: userId, status: createResult.status, registration_id: createResult.registration_id };
    } catch (err: any) {
      mapDatabaseError(err);
    }
  });
};

export const joinTeam = async (userId: string, teamId: string) => {
  return withUserContext(userId, async (tx) => {
    const team = await tx.team.findUnique({ where: { id: teamId } });
    if (!team) throw new NotFoundError('Team not found');

    // Fetch all members before mutation using helper SQL function to bypass RLS
    const resultMembers = await tx.$queryRaw<{ get_team_members: string[] }[]>`
      SELECT get_team_members(${teamId}::uuid);
    `;
    const preMembers = resultMembers[0].get_team_members;
    const wasRegistered = team.status === 'REGISTERED';

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
      mapDatabaseError(err);
    }
  });
};

export const leaveTeam = async (userId: string, teamId: string) => {
  return withUserContext(userId, async (tx) => {
    const team = await tx.team.findUnique({ where: { id: teamId } });
    if (!team) throw new NotFoundError('Team not found');

    // Fetch all members before mutation using helper SQL function to bypass RLS
    const resultMembers = await tx.$queryRaw<{ get_team_members: string[] }[]>`
      SELECT get_team_members(${teamId}::uuid);
    `;
    const preMembers = resultMembers[0].get_team_members;
    const wasRegistered = team.status === 'REGISTERED';

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

      const postTeamResult = await tx.$queryRaw<{ status: string }[]>`SELECT status FROM teams WHERE id = ${teamId}::uuid`;
      const postTeamStatus = postTeamResult[0]?.status;
      const remainingUserIds = preMembers.filter((m: string) => m !== userId);

      if (postTeamStatus === 'CANCELLED') {
        for (const uid of remainingUserIds) {
          await enqueueNotification({
            tx, userId: uid, type: 'TEAM_CANCELLED', title: 'Team Cancelled', body: 'Your team leader left, causing the team to dissolve.',
            metadata: { schema_version: 1, routing: { target: 'event_details', fallback: '/events', params: { id: team.eventId } }, entity_ids: { event_id: team.eventId } },
            preferenceGate: 'push_enabled', idempotencyString: `TEAM_CANCEL_LEAD:${teamId}:${uid}`
          });
        }
      } else if (wasRegistered && postTeamStatus === 'WAITLISTED') {
        for (const uid of remainingUserIds) {
          await enqueueNotification({
            tx, userId: uid, type: 'TEAM_WAITLISTED', title: 'Team Demoted to Waitlist', body: 'A member left and your team fell below the minimum size.',
            metadata: { schema_version: 1, routing: { target: 'event_details', fallback: '/events', params: { id: team.eventId } }, entity_ids: { event_id: team.eventId } },
            preferenceGate: 'push_enabled', idempotencyString: `TEAM_DEMOTE:${teamId}:${uid}`
          });
        }
      }

      return promotedUserIds;
    } catch (err: any) {
      mapDatabaseError(err);
      throw err;
    }
  });
};



export const transferLeadership = async (userId: string, teamId: string, newLeaderId: string) => {
  return withUserContext(userId, async (tx) => {
    const team = await tx.team.findUnique({ where: { id: teamId } });
    if (!team) throw new NotFoundError('Team not found');
    if (team.leaderId !== userId) throw new BadRequestError('Only the leader can transfer leadership');

    try {
      const result = await tx.$queryRaw<{ transfer_leadership: any }[]>`
        SELECT transfer_leadership(${team.eventId}::uuid, ${teamId}::uuid, ${newLeaderId}::uuid);
      `;

      await enqueueNotification({
        tx, userId: newLeaderId, type: 'TEAM_LEADERSHIP_TRANSFERRED', title: 'Leadership Transferred', body: 'You are now the leader of your team.',
        metadata: { schema_version: 1, routing: { target: 'event_details', fallback: '/events', params: { id: team.eventId } }, entity_ids: { event_id: team.eventId } },
        preferenceGate: 'push_enabled', idempotencyString: `TEAM_LEAD_TRANS:${teamId}:${newLeaderId}`
      });

      return result[0].transfer_leadership;
    } catch (err: any) {
      mapDatabaseError(err);
    }
  });
};

export const removeMember = async (userId: string, teamId: string, targetUserId: string) => {
  return withUserContext(userId, async (tx) => {
    const team = await tx.team.findUnique({ where: { id: teamId } });
    if (!team) throw new NotFoundError('Team not found');
    if (team.leaderId !== userId) throw new BadRequestError('Only the leader can remove members');

    try {
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
    } catch (err: any) {
      mapDatabaseError(err);
    }
  });
};
