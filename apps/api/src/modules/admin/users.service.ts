import { prisma } from '../../lib/prisma';
import { ListAdminUsersQuery, UpdateAdminUserRoleBody, UpdateAcademicBatchBody } from './users.schema';
import { ForbiddenError, NotFoundError } from '../../lib/errors';
import { withUserContext } from '@nst/database';

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
        academicProfile: {
          select: {
            batchId: true,
            assignmentSource: true,
            assignedAt: true,
            batch: {
              select: {
                id: true,
                programId: true,
                admissionYear: true,
                graduationYear: true,
                program: {
                  select: {
                    id: true,
                    name: true,
                    code: true,
                  }
                }
              }
            }
          }
        }
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

  async getUser(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        globalRole: true,
        academicProfile: {
          select: {
            batchId: true,
            assignmentSource: true,
            assignedAt: true,
            batch: {
              select: {
                id: true,
                programId: true,
                admissionYear: true,
                graduationYear: true,
                program: {
                  select: {
                    id: true,
                    name: true,
                    code: true,
                  }
                }
              }
            }
          }
        },
        clubMemberships: {
          where: { deletedAt: null },
          select: {
            id: true,
            role: true,
            club: {
              select: {
                id: true,
                name: true,
              }
            }
          }
        }
      }
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    return user;
  },

  async updateUserRole(adminUserId: string, targetUserId: string, payload: UpdateAdminUserRoleBody) {
    const { role: globalRole } = payload;
    return withUserContext(adminUserId, async (tx) => {
      const targetUser = await tx.user.findUnique({
        where: { id: targetUserId },
      });

      if (!targetUser || targetUser.deletedAt) {
        throw new NotFoundError('User not found');
      }

      if (targetUser.id === adminUserId) {
        throw new ForbiddenError('Cannot change own role');
      }

      if (targetUser.globalRole === globalRole) {
        return { message: 'Role is already set to the requested value', user: targetUser };
      }

      const updatedUser = await tx.user.update({
        where: { id: targetUserId },
        data: {
          globalRole: globalRole as any,
          updatedAt: new Date(),
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: adminUserId,
          action: 'UPDATE_ROLE',
          entityType: 'User',
          entityId: targetUserId,
          previousState: { globalRole: targetUser.globalRole },
          newState: { globalRole },
        },
      });

      return updatedUser;
    });
  },

  async updateAcademicBatch(adminUserId: string, targetUserId: string, payload: UpdateAcademicBatchBody) {
    return withUserContext(adminUserId, async (tx) => {
      const { batchId } = payload;

      const targetUser = await tx.user.findUnique({
        where: { id: targetUserId },
      });

      if (!targetUser || targetUser.deletedAt) {
        throw new NotFoundError('User not found');
      }

      const batch = await tx.academicBatch.findUnique({
        where: { id: batchId },
      });

      if (!batch) {
        throw new NotFoundError('Academic batch not found');
      }

      const existingProfile = await tx.userAcademicProfile.findUnique({
        where: { userId: targetUserId },
      });

      const updated = await tx.userAcademicProfile.upsert({
        where: { userId: targetUserId },
        update: {
          batchId,
          assignmentSource: 'ADMIN',
          assignedBy: adminUserId,
          assignedAt: new Date(),
        },
        create: {
          userId: targetUserId,
          batchId,
          assignmentSource: 'ADMIN',
          assignedBy: adminUserId,
          assignedAt: new Date(),
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: adminUserId,
          action: 'UPDATE_ACADEMIC_BATCH',
          entityType: 'User',
          entityId: targetUserId,
          previousState: existingProfile ? { batchId: existingProfile.batchId, assignmentSource: existingProfile.assignmentSource } : undefined,
          newState: { batchId, assignmentSource: 'ADMIN' },
        },
      });

      return updated;
    });
  },
};
