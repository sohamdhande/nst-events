import { prisma } from '../../lib/prisma';
import { ListAdminUsersQuery, UpdateAdminUserRoleBody } from './users.schema';
import { ForbiddenError, NotFoundError } from '../../lib/errors';

export const adminUsersService = {
  async listUsers(query: ListAdminUsersQuery) {
    const { q, cursor, limit } = query;

    const where: any = {
      deletedAt: null,
    };

    if (q) {
      where.OR = [
        { email: { contains: q, mode: 'insensitive' } },
        { fullName: { contains: q, mode: 'insensitive' } },
      ];
    }

    const items = await prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        fullName: true,
        globalRole: true,
      },
      take: limit + 1,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { createdAt: 'desc' },
    });

    let nextCursor: string | undefined = undefined;
    if (items.length > limit) {
      const nextItem = items.pop();
      nextCursor = nextItem!.id;
    }

    return {
      data: items,
      pagination: {
        next_cursor: nextCursor,
      },
    };
  },

  async updateUserRole(adminUserId: string, targetUserId: string, payload: UpdateAdminUserRoleBody) {
    const { role } = payload;

    if (adminUserId === targetUserId) {
      throw new ForbiddenError('Administrators cannot mutate their own role.');
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
    });

    if (!targetUser || targetUser.deletedAt) {
      throw new NotFoundError('User not found');
    }

    if (targetUser.globalRole === role) {
      return { message: 'Role is already set to the requested value', user: targetUser };
    }

    const updatedUser = await prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: targetUserId },
        data: { globalRole: role as any },
        select: {
          id: true,
          email: true,
          fullName: true,
          globalRole: true,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: adminUserId,
          action: 'UPDATE_GLOBAL_ROLE',
          entityType: 'User',
          entityId: targetUserId,
          previousState: { globalRole: targetUser.globalRole },
          newState: { globalRole: role },
        },
      });

      return updated;
    });

    return updatedUser;
  },
};
