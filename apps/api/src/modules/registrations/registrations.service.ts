import { withUserContext } from '@nst/database';
import { enqueueNotification } from '../notifications/notifications.producer';
import { prisma } from '../../lib/prisma';

import { BadRequestError, ForbiddenError, NotFoundError } from '../../lib/errors';
import { mapDatabaseError } from '../../lib/errors/database-error-mapper';

import { checkAudienceEligibility } from '../events/audience.service';

export const registerEvent = async (userId: string, eventId: string) => {
  return withUserContext(userId, async (tx) => {
    try {
      const result = await tx.$queryRaw<{ register_event: any }[]>`
        SELECT register_event(${eventId}::uuid);
      `;
      return result[0].register_event;
    } catch (err: any) {
      mapDatabaseError(err);
    }
  });
};

export const cancelRegistration = async (userId: string, eventId: string) => {
  return withUserContext(userId, async (tx) => {
    try {
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
    } catch (err: any) {
      mapDatabaseError(err);
    }
  });
};

export const getEventRegistrations = async (userId: string, eventId: string, limit: number, cursor?: string, filter_status?: string) => {
  return withUserContext(userId, async (tx) => {
    const where: any = { eventId, deletedAt: null };
    if (filter_status) where.registrationStatus = filter_status;
    
    const take = limit + 1;
    const registrations = await tx.eventRegistration.findMany({
      where,
      take,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      include: { user: { select: { id: true, fullName: true, email: true, globalRole: true } } },
      orderBy: [
        { registeredAt: 'desc' },
        { id: 'asc' }
      ]
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
  });
};

export const getMyRegistrations = async (userId: string): Promise<any[]> => {
  return withUserContext(userId, async (tx) => {
    const registrations = await tx.eventRegistration.findMany({
      where: { userId, deletedAt: null },
      include: { event: true },
      orderBy: { registeredAt: 'desc' }
    });
    return registrations;
  });
};

export const getMyRegistrationStatus = async (userId: string, eventId: string) => {
  return withUserContext(userId, async (tx) => {
    const event = await tx.event.findUnique({
      where: { id: eventId },
      select: { registrationType: true }
    });
    
    if (!event) {
      throw new NotFoundError('Event not found');
    }

    const reg = await tx.eventRegistration.findFirst({
      where: { eventId, userId, deletedAt: null },
      select: { 
        id: true,
        teamId: true, 
        registrationStatus: true,
        registeredAt: true 
      }
    });

    if (!reg) {
      return { status: 'NOT_REGISTERED' };
    }

    let waitlist_position: number | null = null;
    
    if (reg.registrationStatus === 'WAITLISTED') {
      if (event.registrationType === 'INDIVIDUAL') {
        const countResult = await tx.$queryRaw<{ count: number }[]>`
          SELECT COUNT(*)::int as count 
          FROM event_registrations er 
          WHERE er.event_id = ${eventId}::uuid 
            AND er.registration_status = 'WAITLISTED'
            AND er.team_id IS NULL 
            AND er.deleted_at IS NULL
            AND (er.registered_at < ${reg.registeredAt} OR (er.registered_at = ${reg.registeredAt} AND er.id < ${reg.id}::uuid))
        `;
        waitlist_position = countResult[0].count + 1;
      } else if (event.registrationType === 'TEAM' && reg.teamId) {
        const teamRegQuery = await tx.$queryRaw<{ min_reg: Date }[]>`
          SELECT min(er.registered_at) as min_reg
          FROM event_registrations er 
          WHERE er.team_id = ${reg.teamId}::uuid AND er.deleted_at IS NULL
        `;
        const myMinReg = teamRegQuery[0]?.min_reg;

        if (myMinReg) {
          const countResult = await tx.$queryRaw<{ count: number }[]>`
            SELECT COUNT(t.id)::int as count 
            FROM teams t
            WHERE t.event_id = ${eventId}::uuid 
              AND t.status = 'WAITLISTED'
              AND t.deleted_at IS NULL
              AND (
                (SELECT min(er.registered_at) FROM event_registrations er WHERE er.team_id = t.id AND er.deleted_at IS NULL) < ${myMinReg}
                OR (
                  (SELECT min(er.registered_at) FROM event_registrations er WHERE er.team_id = t.id AND er.deleted_at IS NULL) = ${myMinReg} 
                  AND t.id < ${reg.teamId}::uuid
                )
              )
          `;
          waitlist_position = countResult[0].count + 1;
        }
      }
    }

    return { 
      status: reg.registrationStatus,
      team_id: reg.teamId,
      waitlist_position 
    };
  });
};

export const searchEligibleInvitees = async (userId: string, eventId: string, q: string) => {
  return withUserContext(userId, async (tx) => {
    // 1. Verify caller is a leader of an active team for this event.
    // Note: We don't fetch eventRegistrations here because RLS blocks it anyway. We rely on leaderId.
    const callerTeam = await tx.team.findFirst({
      where: { eventId, leaderId: userId, deletedAt: null },
      include: { event: true }
    });

    if (!callerTeam) {
      throw new ForbiddenError('Only the team leader can search for invitees');
    }
    
    const event = callerTeam.event;
    if (!event || event.state !== 'PUBLISHED') throw new BadRequestError('Event not available');
    
    // SQL-authoritative event lock check
    const [eventLockResult] = await tx.$queryRaw<any[]>`SELECT is_locked, (now() >= end_time + interval '24 hours') as is_expired FROM events WHERE id = ${eventId}::uuid`;
    if (eventLockResult.is_locked || eventLockResult.is_expired) {
      throw new BadRequestError('EVENT_LOCKED');
    }

    // Capacity is checked inside is_user_available_for_team, but we can do a quick check here too 
    // to fail fast if we had access to member count. However, the helper covers this.

    // 2. Base query: search fullName in PublicProfile (up to 20 to allow for filtering)
    // We only expose public profiles
    const profiles = await tx.publicProfile.findMany({
      where: {
        deletedAt: null,
        id: { not: userId },
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

    // 3. Audience eligibility filter in TS layer
    if (event.audience === 'SPECIFIC_BATCHES') {
      const validBatches = await tx.eventAudienceBatch.findMany({
        where: { eventId },
        select: { batchId: true }
      });
      const batchIds = validBatches.map((b: any) => b.batchId);
      
      const academicProfiles = await tx.userAcademicProfile.findMany({
        where: {
          userId: { in: profiles.map((p: any) => p.id) },
          batchId: { in: batchIds }
        },
        select: { userId: true }
      });
      
      const eligibleIds = new Set(academicProfiles.map((a: any) => a.userId));
      eligibleProfiles = profiles.filter((p: any) => eligibleIds.has(p.id));
    }

    // 4. Evaluate all candidates against the absolute database invariants in one batch call
    const candidateIds = eligibleProfiles.map((p: any) => p.id);
    if (candidateIds.length === 0) return [];

    const batchResult = await tx.$queryRaw<{ user_id: string, is_available: boolean }[]>`
      SELECT * FROM is_users_available_for_team(${eventId}::uuid, ${callerTeam.id}::uuid, ${candidateIds}::uuid[]);
    `;
    
    const availableSet = new Set(batchResult.filter(r => r.is_available).map(r => r.user_id));

    const finalCandidates = [];
    for (const profile of eligibleProfiles) {
      if (availableSet.has(profile.id)) {
        finalCandidates.push({
          user_id: profile.id,
          display_name: profile.fullName,
          avatar_url: profile.avatarUrl
        });
      }
      if (finalCandidates.length >= 10) break;
    }

    return finalCandidates;
  });
};
