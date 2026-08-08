import { withUserContext } from '@nst/database';
import { enqueueNotification } from '../notifications/notifications.producer';
import { prisma } from '../../lib/prisma';
import { NotFoundError } from '../../lib/errors';

export const createTeam = async (userId: string, eventId: string, teamName: string) => {
  return withUserContext(userId, async (tx) => {
    const result = await tx.$queryRaw<{ create_team: string }[]>`
      SELECT create_team(${eventId}::uuid, ${teamName});
    `;
    return { team_id: result[0].create_team, name: teamName, leader_id: userId };
  });
};

export const joinTeam = async (userId: string, teamId: string) => {
  return withUserContext(userId, async (tx) => {
    const team = await tx.team.findUnique({ where: { id: teamId } });
    if (!team) throw new NotFoundError('Team not found');

    const result = await tx.$queryRaw<{ join_team: any }[]>`
      SELECT join_team(${team.eventId}::uuid, ${teamId}::uuid);
    `;
    return result[0].join_team;
  });
};

export const leaveTeam = async (userId: string, teamId: string) => {
  return withUserContext(userId, async (tx) => {
    const team = await tx.team.findUnique({ where: { id: teamId } });
    if (!team) throw new NotFoundError('Team not found');

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
          body: 'A spot opened up and you are now registered.',
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
  });
};
