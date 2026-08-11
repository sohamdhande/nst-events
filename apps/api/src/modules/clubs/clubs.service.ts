import { ClubRole, ClubStatus, withUserContext, Prisma, prisma } from '@nst/database';
import { ForbiddenError } from '../../lib/errors';
import { enqueueNotification } from '../notifications/notifications.producer';

export const createClub = async (
  callerId: string,
  data: { name: string; description?: string; initial_admin_id: string }
) => {
  return withUserContext(callerId, async (tx) => {
    return tx.club.create({
      data: {
        name: data.name,
        description: data.description,
        status: 'ACTIVE',
        memberships: {
          create: {
            userId: data.initial_admin_id,
            role: 'CLUB_ADMIN',
          },
        },
      },
    });
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
    });

    let next_cursor = undefined;
    const has_more = items.length > options.limit;
    if (has_more) {
      const nextItem = items.pop();
      next_cursor = nextItem!.id;
    }

    return { data: items, pagination: { next_cursor, has_more } };
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
      return { id: membership.id, user_id: membership.userId, role: membership.role };
    } catch (err: any) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new Error('P2002');
      }
      if (err.code === '42501' || err.meta?.code === '42501') {
        throw new ForbiddenError('Access denied by Row-Level Security');
      }
      throw err;
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
      if (err.code === '42501' || err.meta?.code === '42501') {
        throw new ForbiddenError('Access denied by Row-Level Security');
      }
      throw err;
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
      return true;
    } catch (err: any) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
        return false;
      }
      if (err.code === '42501' || err.meta?.code === '42501') {
        throw new ForbiddenError('Access denied by Row-Level Security');
      }
      throw err;
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

    const items = await tx.$queryRaw<{ id: string; _type: string; name: string }[]>`
      SELECT id, 'CLUB' as "_type", name FROM clubs
      WHERE deleted_at IS NULL
      AND to_tsvector('english', name || ' ' || COALESCE(description, '')) @@ plainto_tsquery('english', ${query})
      ORDER BY ts_rank(to_tsvector('english', name || ' ' || COALESCE(description, '')), plainto_tsquery('english', ${query})) DESC, id ASC
      LIMIT ${options.limit + 1} OFFSET ${offset}
    `;

    let next_cursor = undefined;
    const has_more = items.length > options.limit;
    if (has_more) {
      items.pop();
      next_cursor = (offset + options.limit).toString();
    }

    return { data: items, pagination: { next_cursor, has_more } };
  });
};

