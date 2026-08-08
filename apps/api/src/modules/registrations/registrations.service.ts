import { withUserContext } from '@nst/database';
import { enqueueNotification } from '../notifications/notifications.producer';
import { prisma } from '../../lib/prisma';

export const registerEvent = async (userId: string, eventId: string) => {
  return withUserContext(userId, async (tx) => {
    const result = await tx.$queryRaw<{ register_event: any }[]>`
      SELECT register_event(${eventId}::uuid);
    `;
    return result[0].register_event;
  });
};

export const cancelRegistration = async (userId: string, eventId: string) => {
  return withUserContext(userId, async (tx) => {
    const result = await tx.$queryRaw<{ cancel_registration: string[] }[]>`
      SELECT cancel_registration(${eventId}::uuid, ${userId}::uuid);
    `;
    
    const promotedUserIds = result[0].cancel_registration;
    
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
            routing: { target: 'event_details', fallback: '/events', params: { id: eventId } },
            entity_ids: { event_id: eventId }
          },
          preferenceGate: 'push_enabled',
          idempotencyString: `WAITLIST_PROMOTED:${uid}:${eventId}`
        });
      }
    }
    
    return promotedUserIds;
  });
};

export const getEventRegistrations = async (userId: string, eventId: string, limit: number, cursor?: string, filter_status?: string) => {
  const where: any = { eventId, deletedAt: null };
  if (filter_status) where.registrationStatus = filter_status;
  
  const take = limit + 1;
  const registrations = await prisma.eventRegistration.findMany({
    where,
    take,
    skip: cursor ? 1 : 0,
    cursor: cursor ? { id: cursor } : undefined,
    include: { user: { select: { id: true, fullName: true, email: true, globalRole: true } } },
    orderBy: { registeredAt: 'desc' }
  });

  const has_more = registrations.length > limit;
  if (has_more) registrations.pop();
  
  return {
    data: registrations,
    pagination: {
      next_cursor: has_more ? registrations[registrations.length - 1].id : null,
      has_more
    }
  };
};

export const getMyRegistrations = async (userId: string): Promise<any[]> => {
  const registrations = await prisma.eventRegistration.findMany({
    where: { userId, deletedAt: null },
    include: { event: true },
    orderBy: { registeredAt: 'desc' }
  });
  return registrations;
};
