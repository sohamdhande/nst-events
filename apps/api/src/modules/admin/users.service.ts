import { prisma } from '../../lib/prisma';
import { ListAdminUsersQuery, UpdateAdminUserRoleBody, UpdateAcademicBatchBody } from './users.schema';
import { ForbiddenError, NotFoundError, ValidationError } from '../../lib/errors';
import { withUserContext, AssignmentSource } from '@nst/database';

export const adminUsersService = {
  async listUsers(query: ListAdminUsersQuery) {
    const { q, cursor, limit, scope } = query;
    console.log("!!! ADMIN USERS QUERY !!!", query);


    const where: any = {
      deletedAt: null,
    };

    if (scope === 'administrators') {
      where.OR = [
        { globalRole: { in: ['PLATFORM_ADMIN', 'FACULTY_ADMIN', 'FACULTY_MENTOR'] } },
        { clubMemberships: { some: { role: 'CLUB_ADMIN', deletedAt: null } } }
      ];
    }

    if (q) {
      const qCondition = [
        { email: { contains: q, mode: 'insensitive' } },
        { fullName: { contains: q, mode: 'insensitive' } },
      ];
      if (where.OR) {
        where.AND = [{ OR: where.OR }, { OR: qCondition }];
        delete where.OR;
      } else {
        where.OR = qCondition;
      }
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
        },
        ...(scope === 'administrators' ? {
          clubMemberships: {
            where: { role: 'CLUB_ADMIN', deletedAt: null },
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
        } : {})
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
    
    let platformAdminCount = 0;
    if (scope === 'administrators') {
      platformAdminCount = await prisma.user.count({
        where: { globalRole: 'PLATFORM_ADMIN', deletedAt: null }
      });
    }

    return {
      data: items,
      pagination: {
        next_cursor: nextCursor,
      },
      ...(scope === 'administrators' ? { platform_admin_count: platformAdminCount } : {})
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
      // Acquire transaction-level advisory lock to serialize concurrent role mutations
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('PLATFORM_ADMIN_MUTATION'))`;

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

      if (targetUser.globalRole === 'PLATFORM_ADMIN' && globalRole !== 'PLATFORM_ADMIN') {
        const platformAdminCount = await tx.user.count({
          where: { globalRole: 'PLATFORM_ADMIN', deletedAt: null },
        });
        if (platformAdminCount <= 1) {
          throw new ForbiddenError('LAST_PLATFORM_ADMIN');
        }
      }

      const updatedUser = await tx.user.update({
        where: { id: targetUserId },
        data: {
          globalRole: globalRole as any,
          updatedAt: new Date(),
          securityVersion: { increment: 1 },
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
          assignmentSource: AssignmentSource.ADMIN_OVERRIDE,
          assignedBy: adminUserId,
          assignedAt: new Date(),
        },
        create: {
          userId: targetUserId,
          batchId,
          assignmentSource: AssignmentSource.ADMIN_OVERRIDE,
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
          newState: { batchId, assignmentSource: AssignmentSource.ADMIN_OVERRIDE },
        },
      });

      return updated;
    });
  },

  async provisionUser(adminUserId: string, payload: { email: string, globalRole?: string, clubId?: string, clubRole?: string }) {
    return withUserContext(adminUserId, async (tx) => {
      const { email, globalRole, clubId, clubRole } = payload;
      const normalizedEmail = email.toLowerCase().trim();
      const domain = normalizedEmail.split('@')[1];

      let effectiveGlobalRole = globalRole;

      if (domain === 'newtonschool.co') {
        if (!effectiveGlobalRole || effectiveGlobalRole === 'STUDENT') throw new ValidationError('Invalid role for domain');
      } else if (domain === 'adypu.edu.in') {
        effectiveGlobalRole = 'STUDENT';
      } else {
        throw new ValidationError('Unsupported domain');
      }

      if (clubId) {
        const club = await tx.club.findUnique({ where: { id: clubId } });
        if (!club || club.deletedAt || club.status === 'DISSOLVED') {
          throw new ValidationError('Invalid or inactive club');
        }
      }

      const existing = await tx.user.findUnique({
        where: { email: normalizedEmail },
      });

      let userId = existing?.id;

      if (!existing) {
        const dummySub = `provisioned:${normalizedEmail}`;

        const user = await tx.user.create({
          data: {
            email: normalizedEmail,
            googleSub: dummySub,
            fullName: 'Not yet registered',
            globalRole: effectiveGlobalRole as any,
          },
        });
        
        userId = user.id;

        await tx.auditLog.create({
          data: {
            actorId: adminUserId,
            action: 'PROVISION_USER',
            entityType: 'User',
            entityId: user.id,
            newState: { globalRole: effectiveGlobalRole, email: normalizedEmail },
          },
        });
      }

      let user = await tx.user.findUniqueOrThrow({ where: { id: userId } });

      if (clubId && clubRole === 'CLUB_ADMIN') {
        // Create club membership if not exists
        const existingMembership = await tx.clubMembership.findFirst({
          where: { userId: user.id, clubId, role: 'CLUB_ADMIN', deletedAt: null }
        });
        
        if (!existingMembership) {
          await tx.clubMembership.create({
            data: {
              userId: user.id,
              clubId,
              role: 'CLUB_ADMIN'
            }
          });
          
          await tx.auditLog.create({
            data: {
              actorId: adminUserId,
              action: 'ADD_CLUB_MEMBER',
              entityType: 'Club',
              entityId: clubId,
              newState: { userId: user.id, role: 'CLUB_ADMIN' }
            }
          });
        }
      }

      // Re-fetch to return full state (e.g., if we were to return it, though we just return user)
      return user;
    });
  },
};
