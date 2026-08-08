import { withUserContext } from '@nst/database';
import { prisma } from '../../lib/prisma';
import { NotFoundError, UnprocessableEntityError } from '../../lib/errors';
import { Prisma, Event, AttendanceSession } from '@nst/database';
import {
  CreateEventInput,
  ListEventsQuery,
  UpdateEventInput,
  CreateSessionInput,
  UpdateSessionInput,
} from './events.schema';
import { enqueueNotification } from '../notifications/notifications.producer';

export const createEvent = async (callerId: string, data: CreateEventInput): Promise<any> => {
  return withUserContext(callerId, async (tx) => {
    const primaryClubs = data.club_ids.filter((c) => c.is_primary);
    if (primaryClubs.length !== 1) {
      throw new UnprocessableEntityError('Exactly one club must be marked as primary');
    }

    const event = await tx.event.create({
      data: {
        title: data.title,
        description: data.description,
        startTime: data.start_time,
        endTime: data.end_time,
        locationName: data.location_name,
        eventType: data.event_type,
        visibility: data.visibility,
        registrationType: data.registration_type,
        attendanceType: data.attendance_type,
        metadata: (data.metadata || {}) as Prisma.InputJsonValue,
        createdBy: callerId,
        maxCapacity: data.max_capacity,
        eventClubs: {
          create: data.club_ids.map((c) => ({
            clubId: c.club_id,
            isPrimary: c.is_primary,
          })),
        },
      },
      include: {
        eventClubs: { include: { club: true } },
      },
    });

    if (data.location_lat !== undefined && data.location_lng !== undefined) {
      await tx.$executeRaw`
        UPDATE events 
        SET location_geofence = ST_SetSRID(ST_MakePoint(${data.location_lng}, ${data.location_lat}), 4326) 
        WHERE id = ${event.id}::uuid
      `;
      const geo = await tx.$queryRaw<{ geojson: string }[]>`
        SELECT ST_AsGeoJSON(location_geofence) as geojson FROM events WHERE id = ${event.id}::uuid
      `;
      (event as any).location_geofence = geo[0]?.geojson ? JSON.parse(geo[0].geojson) : null;
    } else {
      (event as any).location_geofence = null;
    }

    return event;
  });
};

export const listEvents = async (callerId: string, query: ListEventsQuery): Promise<any> => {
  return withUserContext(callerId, async (tx) => {
    const where: Prisma.EventWhereInput = { deletedAt: null };

    if (query.filter_state) where.state = query.filter_state;
    if (query.filter_event_type) where.eventType = query.filter_event_type;
    if (query.filter_visibility) where.visibility = query.filter_visibility;
    if (query.filter_club_id) {
      where.eventClubs = { some: { clubId: query.filter_club_id } };
    }

    if (query.q) {
      const fts = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM events 
        WHERE deleted_at IS NULL
        AND search_vector @@ plainto_tsquery('english', ${query.q})
        LIMIT 1000
      `;
      where.id = { in: fts.map((f) => f.id) };
    }

    const items = await tx.event.findMany({
      where,
      take: query.limit + 1,
      cursor: query.cursor ? { id: query.cursor } : undefined,
      orderBy: query.sort === 'created_at' ? { createdAt: query.order } : { startTime: query.order },
      include: { eventClubs: { include: { club: true } } },
    });

    const has_more = items.length > query.limit;
    if (has_more) items.pop();
    const next_cursor = has_more ? items[items.length - 1].id : undefined;

    if (items.length > 0) {
      const ids = items.map((i) => i.id);
      const geo = await tx.$queryRaw<{ id: string; geojson: string }[]>`
        SELECT id, ST_AsGeoJSON(location_geofence) as geojson 
        FROM events 
        WHERE id IN (${Prisma.join(ids.map(id => Prisma.sql`${id}::uuid`))})
      `;
      const geoMap = new Map(geo.map((g) => [g.id, g.geojson ? JSON.parse(g.geojson) : null]));
      for (const item of items) {
        (item as any).location_geofence = geoMap.get(item.id) || null;
      }
    }

    return { data: items, pagination: { next_cursor, has_more } };
  });
};

export const getEventById = async (callerId: string, eventId: string): Promise<any> => {
  return withUserContext(callerId, async (tx) => {
    const event = await tx.event.findUnique({
      where: { id: eventId },
      include: {
        eventClubs: { include: { club: true } },
        attendanceSessions: { where: { deletedAt: null } },
        _count: { select: { eventRegistrations: { where: { deletedAt: null } } } },
      },
    });

    if (!event || event.deletedAt) {
      throw new NotFoundError('Event not found');
    }

    const geo = await tx.$queryRaw<{ geojson: string }[]>`
      SELECT ST_AsGeoJSON(location_geofence) as geojson FROM events WHERE id = ${eventId}::uuid
    `;
    (event as any).location_geofence = geo[0]?.geojson ? JSON.parse(geo[0].geojson) : null;

    return event;
  });
};

export const updateEvent = async (callerId: string, eventId: string, data: UpdateEventInput): Promise<any> => {
  return withUserContext(callerId, async (tx) => {
    const existing = await tx.event.findUnique({
      where: { id: eventId },
      select: { state: true, deletedAt: true },
    });

    if (!existing || existing.deletedAt) {
      throw new NotFoundError('Event not found');
    }

    if (existing.state !== 'DRAFT') {
      throw new UnprocessableEntityError('Event can only be updated in DRAFT state');
    }

    const event = await tx.event.update({
      where: { id: eventId },
      data: {
        title: data.title,
        description: data.description,
        startTime: data.start_time,
        endTime: data.end_time,
        locationName: data.location_name,
        eventType: data.event_type,
        visibility: data.visibility,
        registrationType: data.registration_type,
        attendanceType: data.attendance_type,
        metadata: data.metadata ? (data.metadata as Prisma.InputJsonValue) : undefined,
        maxCapacity: data.max_capacity,
      },
      include: {
        eventClubs: { include: { club: true } },
      },
    });

    if (data.location_lat !== undefined && data.location_lng !== undefined) {
      await tx.$executeRaw`
        UPDATE events 
        SET location_geofence = ST_SetSRID(ST_MakePoint(${data.location_lng}, ${data.location_lat}), 4326) 
        WHERE id = ${eventId}::uuid
      `;
    }

    const geo = await tx.$queryRaw<{ geojson: string }[]>`
      SELECT ST_AsGeoJSON(location_geofence) as geojson FROM events WHERE id = ${eventId}::uuid
    `;
    (event as any).location_geofence = geo[0]?.geojson ? JSON.parse(geo[0].geojson) : null;

    return event;
  });
};

export const deleteEvent = async (callerId: string, eventId: string) => {
  return withUserContext(callerId, async (tx) => {
    const existing = await tx.event.findUnique({
      where: { id: eventId },
      select: { deletedAt: true },
    });

    if (!existing || existing.deletedAt) {
      throw new NotFoundError('Event not found');
    }

    await tx.event.update({
      where: { id: eventId },
      data: { deletedAt: new Date() },
    });
  });
};

export const submitForApproval = async (callerId: string, eventId: string) => {
  return withUserContext(callerId, async (tx) => {
    const event = await tx.event.findUnique({
      where: { id: eventId },
      include: { eventClubs: { include: { club: true } } },
    });
    if (!event) throw new NotFoundError('Event not found');

    await tx.$queryRaw`SELECT id FROM submit_event_for_approval(${eventId}::uuid)`;

    // Notify Faculty Mentor and Platform Admins
    const clubName = event.eventClubs.find(c => c.isPrimary)?.club.name || 'A club';
    const mentors = await tx.clubMembership.findMany({
      where: { clubId: { in: event.eventClubs.map(c => c.clubId) }, role: 'FACULTY_MENTOR', deletedAt: null },
      select: { userId: true },
    });
    const platformAdmins = await tx.user.findMany({
      where: { globalRole: 'PLATFORM_ADMIN', deletedAt: null },
      select: { id: true },
    });
    
    const recipients = new Set([...mentors.map(m => m.userId), ...platformAdmins.map(a => a.id)]);
    
    for (const userId of recipients) {
      await enqueueNotification({
        tx,
        userId,
        type: 'APPROVAL_REQUEST',
        title: 'Action Required: Event Approval',
        body: `${clubName} has requested approval for ${event.title}.`,
        metadata: {
          schema_version: 1,
          routing: { target: `/approvals/${eventId}`, fallback: '/approvals', params: { event_id: eventId } },
          entity_ids: { event_id: eventId, club_id: event.eventClubs[0]?.clubId },
          action_payload: { status: 'PENDING_APPROVAL' },
        },
        preferenceGate: 'push_enabled',
        priority: 'HIGH',
        idempotencyString: `APPROVAL_REQUEST${userId}${eventId}pending_approval`,
      });
    }

    return { state: 'PENDING_APPROVAL' };
  });
};

export const approveEvent = async (callerId: string, eventId: string) => {
  return withUserContext(callerId, async (tx) => {
    const event = await tx.event.findUnique({
      where: { id: eventId },
      include: { eventClubs: { include: { club: true } } },
    });
    if (!event) throw new NotFoundError('Event not found');

    await tx.$queryRaw`SELECT id FROM approve_event(${eventId}::uuid)`;

    const clubName = event.eventClubs.find(c => c.isPrimary)?.club.name || 'A club';
    
    // Notify Club Members (as eligible students)
    const members = await tx.clubMembership.findMany({
      where: { clubId: { in: event.eventClubs.map(c => c.clubId) }, deletedAt: null },
      select: { userId: true },
    });

    const recipients = new Set(members.map(m => m.userId));

    for (const userId of recipients) {
      await enqueueNotification({
        tx,
        userId,
        type: 'EVENT_APPROVED',
        title: `New Event: ${event.title}`,
        body: `${clubName} just published a new event!`,
        metadata: {
          schema_version: 1,
          routing: { target: `/events/${eventId}`, fallback: '/events', params: { event_id: eventId } },
          entity_ids: { event_id: eventId, club_id: event.eventClubs[0]?.clubId },
          action_payload: { status: 'PUBLISHED' },
        },
        preferenceGate: 'club_announcements',
        idempotencyString: `EVENT_APPROVED${userId}${eventId}published`,
      });
    }

    return { state: 'PUBLISHED' };
  });
};

export const rejectEvent = async (callerId: string, eventId: string, reason: string) => {
  return withUserContext(callerId, async (tx) => {
    const event = await tx.event.findUnique({
      where: { id: eventId },
      include: { eventClubs: true },
    });
    if (!event) throw new NotFoundError('Event not found');

    await tx.$queryRaw`SELECT id FROM reject_event(${eventId}::uuid, ${reason})`;

    const admins = await tx.clubMembership.findMany({
      where: { clubId: { in: event.eventClubs.map(c => c.clubId) }, role: 'CLUB_ADMIN', deletedAt: null },
      select: { userId: true },
    });

    const recipients = new Set([...admins.map(a => a.userId), event.createdBy]);

    for (const userId of recipients) {
      await enqueueNotification({
        tx,
        userId,
        type: 'EVENT_REJECTED',
        title: `Event Rejected: ${event.title}`,
        body: `Your event was rejected. Feedback: ${reason}`,
        metadata: {
          schema_version: 1,
          routing: { target: `/events/${eventId}/edit`, fallback: '/dashboard', params: { event_id: eventId } },
          entity_ids: { event_id: eventId },
          action_payload: { status: 'REJECTED' },
        },
        preferenceGate: 'push_enabled',
        priority: 'HIGH',
        idempotencyString: `EVENT_REJECTED${userId}${eventId}rejected`,
      });
    }

    return { state: 'DRAFT' };
  });
};

export const lockEvent = async (callerId: string, eventId: string) => {
  return withUserContext(callerId, async (tx) => {
    await tx.$queryRaw`SELECT id FROM lock_event(${eventId}::uuid)`;
    return { is_locked: true };
  });
};

export const unlockEvent = async (callerId: string, eventId: string) => {
  return withUserContext(callerId, async (tx) => {
    await tx.$queryRaw`SELECT id FROM unlock_event(${eventId}::uuid)`;
    return { is_locked: false };
  });
};

export const createSession = async (
  callerId: string,
  eventId: string,
  data: CreateSessionInput
) => {
  return withUserContext(callerId, async (tx) => {
    const event = await tx.event.findUnique({
      where: { id: eventId },
      select: { state: true, deletedAt: true },
    });

    if (!event || event.deletedAt) {
      throw new NotFoundError('Event not found');
    }

    if (event.state === 'ARCHIVED') {
      throw new UnprocessableEntityError('Cannot add sessions to archived events');
    }

    return tx.attendanceSession.create({
      data: {
        eventId,
        title: data.title,
        startTime: data.start_time,
        endTime: data.end_time,
        openAt: data.open_at,
        closeAt: data.close_at,
        geofenceRadius: data.geofence_radius,
      },
    });
  });
};

export const listSessions = async (callerId: string, eventId: string) => {
  return withUserContext(callerId, async (tx) => {
    const event = await tx.event.findUnique({
      where: { id: eventId },
      select: { deletedAt: true },
    });

    if (!event || event.deletedAt) {
      throw new NotFoundError('Event not found');
    }

    return tx.attendanceSession.findMany({
      where: { eventId, deletedAt: null },
      orderBy: { startTime: 'asc' },
    });
  });
};

export const updateSession = async (
  callerId: string,
  eventId: string,
  sessionId: string,
  data: UpdateSessionInput
) => {
  return withUserContext(callerId, async (tx) => {
    const session = await tx.attendanceSession.findUnique({
      where: { id: sessionId },
      select: { eventId: true, deletedAt: true },
    });

    if (!session || session.deletedAt || session.eventId !== eventId) {
      throw new NotFoundError('Session not found');
    }

    return tx.attendanceSession.update({
      where: { id: sessionId },
      data: {
        title: data.title,
        startTime: data.start_time,
        endTime: data.end_time,
        openAt: data.open_at,
        closeAt: data.close_at,
        geofenceRadius: data.geofence_radius,
      },
    });
  });
};
