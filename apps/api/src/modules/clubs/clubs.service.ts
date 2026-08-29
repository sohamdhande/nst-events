import { ClubRole, ClubStatus, withUserContext, Prisma, prisma } from '@nst/database';
import { ConflictError } from '../../lib/errors';
import { mapDatabaseError } from '../../lib/errors/database-error-mapper';
import { enqueueNotification } from '../notifications/notifications.producer';

export const createClub = async (
  callerId: string,
  data: { name: string; description?: string; initial_admin_id: string; banner_url?: string | null }
) => {
  return withUserContext(callerId, async (tx) => {
    try {
      const club = await tx.club.create({
        data: {
          name: data.name,
          description: data.description,
          ...(data.banner_url && { bannerUrl: data.banner_url }),
          status: 'ACTIVE',
          memberships: {
            create: {
              userId: data.initial_admin_id,
              role: 'CLUB_ADMIN',
            },
          },
        },
      });
      await tx.$executeRaw`SELECT increment_user_security_version(${data.initial_admin_id}::uuid)`;
      return club;
    } catch (err: any) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictError('Club name already exists');
      }
      mapDatabaseError(err);
      throw err;
    }
  });
};

export const updateClub = async (
  callerId: string,
  clubId: string,
  data: { name?: string; description?: string | null; banner_url?: string | null }
) => {
  return withUserContext(callerId, async (tx) => {
    const club = await tx.club.findUnique({
      where: { id: clubId },
      include: {
        memberships: {
          where: { deletedAt: null },
        },
        _count: {
          select: { eventClubs: true },
        },
      },
    });

    if (!club || club.deletedAt) return null;

    try {
      const updated = await tx.club.update({
        where: { id: clubId },
        data: {
          ...(data.name !== undefined && { name: data.name }),
          ...(data.description !== undefined && { description: data.description }),
          ...(data.banner_url !== undefined && { bannerUrl: data.banner_url }),
        },
      });

      const userIds = club.memberships.map((m) => m.userId);
      const profiles = await tx.publicProfile.findMany({
        where: { id: { in: userIds } },
        select: { id: true, fullName: true, avatarUrl: true },
      });
      const profileMap = new Map(profiles.map((p) => [p.id, p]));

      return {
        id: updated.id,
        name: updated.name,
        description: updated.description,
        banner_url: updated.bannerUrl,
        status: updated.status,
        event_count: club._count.eventClubs,
        members: club.memberships.map((m) => {
          const profile = profileMap.get(m.userId) || { fullName: 'Unknown', avatarUrl: null };
          return {
            user_id: m.userId,
            role: m.role,
            full_name: profile.fullName,
            avatar_url: profile.avatarUrl,
          };
        }),
      };
    } catch (err: any) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictError('Club name already exists');
      }
      throw err;
    }
  });
};

export const updateClubStatus = async (
  callerId: string,
  clubId: string,
  newStatus: ClubStatus
) => {
  return withUserContext(callerId, async (tx) => {
    const club = await tx.club.findUnique({
      where: { id: clubId },
      select: { status: true },
    });

    if (!club) return null;

    if (club.status === 'DISSOLVED') {
      throw new Error('Cannot transition status from DISSOLVED');
    }

    try {
      return await tx.club.update({
        where: { id: clubId },
        data: { status: newStatus },
        select: { id: true, status: true },
      });
    } catch (err: any) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
        return null;
      }
      throw err;
    }
  });
};

export const getClubs = async (
  callerId: string,
  options: { cursor?: string; limit: number; sort: 'name' | 'created_at'; order: 'asc' | 'desc' }
) => {
  return withUserContext(callerId, async (tx) => {
    const items = await tx.club.findMany({
      take: options.limit + 1,
      cursor: options.cursor ? { id: options.cursor } : undefined,
      orderBy:
        options.sort === 'name'
          ? { name: options.order }
          : { createdAt: options.order },
      where: { deletedAt: null },
      include: {
        _count: {
          select: {
            eventClubs: true,
            memberships: { where: { deletedAt: null } },
          },
        },
      },
    });

    let next_cursor = undefined;
    const has_more = items.length > options.limit;
    if (has_more) {
      const nextItem = items.pop();
      next_cursor = nextItem!.id;
    }

    const data = items.map((club) => ({
      id: club.id,
      name: club.name,
      description: club.description,
      status: club.status,
      banner_url: club.bannerUrl,
      event_count: club._count.eventClubs,
      member_count: club._count.memberships,
    }));

    return { data, pagination: { next_cursor, has_more } };
  });
};

export const getClub = async (callerId: string, clubId: string) => {
  return withUserContext(callerId, async (tx) => {
    const club = await tx.club.findUnique({
      where: { id: clubId },
      include: {
        memberships: {
          where: { deletedAt: null },
        },
        _count: {
          select: { eventClubs: true },
        },
      },
    });

    if (!club || club.deletedAt) return null;

    const userIds = club.memberships.map((m) => m.userId);
    const profiles = await tx.publicProfile.findMany({
      where: { id: { in: userIds } },
      select: { id: true, fullName: true, avatarUrl: true },
    });
    const profileMap = new Map(profiles.map((p) => [p.id, p]));

    return {
      id: club.id,
      name: club.name,
      description: club.description,
      banner_url: club.bannerUrl,
      status: club.status,
      event_count: club._count.eventClubs,
      members: club.memberships.map((m) => {
        const profile = profileMap.get(m.userId) || { fullName: 'Unknown', avatarUrl: null };
        return {
          user_id: m.userId,
          role: m.role,
          full_name: profile.fullName,
          avatar_url: profile.avatarUrl,
        };
      }),
    };
  });
};

export const addMember = async (
  callerId: string,
  clubId: string,
  userId: string,
  role: ClubRole
) => {
  return withUserContext(callerId, async (tx) => {
    try {
      const membership = await tx.clubMembership.create({
        data: {
          clubId,
          userId,
          role,
        },
      });
      await tx.$executeRaw`SELECT increment_user_security_version(${userId}::uuid)`;
      return { id: membership.id, user_id: membership.userId, role: membership.role };
    } catch (err: any) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictError('User already a member');
      }
      mapDatabaseError(err);
    }
  });
};

export const updateMemberRole = async (
  callerId: string,
  clubId: string,
  userId: string,
  role: ClubRole
) => {
  return withUserContext(callerId, async (tx) => {
    const membership = await tx.clubMembership.findFirst({
      where: { clubId, userId, deletedAt: null },
    });

    if (!membership) return null;

    try {
      const updated = await tx.clubMembership.update({
        where: { id: membership.id },
        data: { role },
      });
      await tx.$executeRaw`SELECT increment_user_security_version(${userId}::uuid)`;

      const club = await tx.club.findUnique({
        where: { id: clubId },
        select: { name: true },
      });

      await enqueueNotification({
        tx,
        userId,
        type: 'ROLE_CHANGED',
        title: 'Your role has been updated',
        body: `You are now a ${role} in ${club?.name || 'the club'}.`,
        metadata: {
          schema_version: 1,
          routing: { target: `/clubs/${clubId}`, fallback: '/clubs', params: { club_id: clubId } },
          entity_ids: { club_id: clubId },
          action_payload: { role },
        },
        preferenceGate: 'push_enabled',
        idempotencyString: `ROLE_CHANGED${userId}${clubId}${role}`,
      });

      return { id: updated.id, user_id: updated.userId, role: updated.role };
    } catch (err: any) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
        return null;
      }
      mapDatabaseError(err);
    }
  });
};

export const removeMember = async (callerId: string, clubId: string, userId: string) => {
  return withUserContext(callerId, async (tx) => {
    const membership = await tx.clubMembership.findFirst({
      where: { clubId, userId, deletedAt: null },
    });

    if (!membership) return false;

    try {
      await tx.clubMembership.update({
        where: { id: membership.id },
        data: { deletedAt: new Date() },
      });
      await tx.$executeRaw`SELECT increment_user_security_version(${userId}::uuid)`;
      return true;
    } catch (err: any) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
        return false;
      }
      mapDatabaseError(err);
    }
  });
};

export const searchClubs = async (
  callerId: string,
  query: string,
  options: { cursor?: string; limit: number }
) => {
  return withUserContext(callerId, async (tx) => {
    // Implement offset-based cursor pagination. 
    // The API contract uses `cursor` (string), so we encode the offset as a string.
    let offset = 0;
    if (options.cursor) {
      offset = parseInt(options.cursor, 10);
      if (isNaN(offset)) offset = 0;
    }

    const fts = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM clubs
      WHERE deleted_at IS NULL
      AND to_tsvector('english', name || ' ' || COALESCE(description, '')) @@ plainto_tsquery('english', ${query})
      ORDER BY ts_rank(to_tsvector('english', name || ' ' || COALESCE(description, '')), plainto_tsquery('english', ${query})) DESC, id ASC
      LIMIT ${options.limit + 1} OFFSET ${offset}
    `;

    const items = await tx.club.findMany({
      where: { id: { in: fts.map((f) => f.id) } },
      include: {
        _count: {
          select: {
            eventClubs: true,
            memberships: { where: { deletedAt: null } },
          },
        },
      },
    });

    // Re-order based on FTS output
    const itemsMap = new Map(items.map((i) => [i.id, i]));
    const sortedItems = fts.map((f) => itemsMap.get(f.id)).filter(Boolean) as typeof items;

    let next_cursor = undefined;
    const has_more = sortedItems.length > options.limit;
    if (has_more) {
      sortedItems.pop();
      next_cursor = (offset + options.limit).toString();
    }

    const data = sortedItems.map((club) => ({
      id: club.id,
      name: club.name,
      description: club.description,
      status: club.status,
      banner_url: club.bannerUrl,
      event_count: club._count.eventClubs,
      member_count: club._count.memberships,
    }));

    return { data, pagination: { next_cursor, has_more } };
  });
};


export const getClubAnalytics = async (callerId: string, clubId: string) => {
  return withUserContext(callerId, async (tx) => {
    // 1. Total events
    const total_events = await tx.event.count({
      where: { eventClubs: { some: { clubId } }, deletedAt: null },
    });

    // 2. Pipeline counts
    const events = await tx.event.findMany({
      where: { eventClubs: { some: { clubId } }, deletedAt: null },
      select: { state: true },
    });
    
    const pipeline_counts: Record<string, number> = {
      DRAFT: 0,
      PENDING_APPROVAL: 0,
      PUBLISHED: 0,
      LOCKED: 0,
      ARCHIVED: 0,
    };
    for (const evt of events) {
      pipeline_counts[evt.state] = (pipeline_counts[evt.state] || 0) + 1;
    }

    // 3. Total registrations
    const total_registrations = await tx.eventRegistration.count({
      where: {
        event: { eventClubs: { some: { clubId } }, deletedAt: null },
        deletedAt: null,
      },
    });

    // 4. Total attendance
    const total_attendance = await tx.attendanceRecord.count({
      where: {
        session: { event: { eventClubs: { some: { clubId } } } },
        status: 'PRESENT',
      },
    });

    // 5. Unique attendees
    const unique_attendees_groups = await tx.attendanceRecord.groupBy({
      by: ['userId'],
      where: {
        session: { event: { eventClubs: { some: { clubId } } } },
        status: 'PRESENT',
      },
    });
    const unique_attendees = unique_attendees_groups.length;

    // 6. Attendance Rate
    const attendance_rate = total_registrations > 0 
      ? Math.round((total_attendance / total_registrations) * 100)
      : 0;

    return {
      total_events,
      total_registrations,
      total_attendance,
      unique_attendees,
      attendance_rate,
      pipeline_counts,
    };
  });
};

export const getClubActivity = async (callerId: string, clubId: string) => {
  return withUserContext(callerId, async (tx) => {
    // Audit logs for events in this club
    const clubEvents = await tx.eventClub.findMany({
      where: { clubId },
      select: { eventId: true },
    });
    const eventIds = clubEvents.map(e => e.eventId);

    if (eventIds.length === 0) {
      return [];
    }

    // Bypass RLS safely by executing Prisma query as system but strictly filtering to eventIds
    // We must use queryRaw because auditLogs RLS blocks normal select unless PLATFORM_ADMIN.
    const auditLogs = await prisma.$queryRaw<any[]>`
      SELECT 
        al.id, 
        al.action, 
        al.entity_type, 
        al.entity_id, 
        al.created_at,
        u.full_name as actor_name
      FROM audit_logs al
      LEFT JOIN users u ON u.id = al.actor_id
      WHERE al.entity_type = 'EVENT' 
        AND al.entity_id::uuid = ANY (${eventIds}::uuid[])
      ORDER BY al.created_at DESC
      LIMIT 50
    `;

    return auditLogs.map(log => ({
      id: log.id.toString(),
      action: log.action,
      entity_type: log.entity_type,
      entity_id: log.entity_id,
      created_at: log.created_at,
      actor_name: log.actor_name || 'System',
    }));
  });
};
