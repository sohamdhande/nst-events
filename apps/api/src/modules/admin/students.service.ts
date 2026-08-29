import { prisma } from '../../lib/prisma';
import { withUserContext } from '@nst/database';
import { BadRequestError, NotFoundError } from '../../lib/errors';
import { DirectoryStatus } from '@nst/database';

export const studentsService = {
  async listStudents(adminUserId: string, query: { q?: string; cursor?: string; limit: number; status?: string }) {
    const { q, cursor, limit, status } = query;

    const where: any = {};
    if (q) {
      where.normalizedEmail = { contains: q.toLowerCase() };
    }
    if (status && (status === 'ACTIVE' || status === 'REVOKED')) {
      where.status = status;
    }

    return withUserContext(adminUserId, async (tx) => {
      const items = await tx.authorizedStudent.findMany({
        where,
        take: limit + 1,
        cursor: cursor ? { id: cursor } : undefined,
        orderBy: { createdAt: 'desc' },
      });

      let nextCursor: string | undefined = undefined;
      if (items.length > limit) {
        const nextItem = items.pop();
        nextCursor = nextItem!.id;
      }

      // Attempt to join with User and UserAcademicProfile to enrich the output
      // for users who have already logged in.
      const enrichedItems = await Promise.all(
        items.map(async (student) => {
          const user = await tx.user.findUnique({
            where: { email: student.normalizedEmail },
            select: {
              id: true,
              fullName: true,
              globalRole: true,
              clubMemberships: {
                where: { role: 'CLUB_ADMIN', deletedAt: null },
                select: { role: true },
              },
              academicProfile: {
                select: {
                  batch: {
                    select: {
                      admissionYear: true,
                      graduationYear: true,
                      program: {
                        select: {
                          name: true,
                          code: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          });
          return {
            ...student,
            user,
          };
        })
      );

      return {
        data: enrichedItems,
        pagination: {
          next_cursor: nextCursor,
        },
      };
    });
  },

  async addStudent(adminUserId: string, email: string) {
    const normalizedEmail = email.trim().toLowerCase();
    
    // Must strictly be @adypu.edu.in
    if (!normalizedEmail.endsWith('@adypu.edu.in')) {
      throw new BadRequestError('Only @adypu.edu.in addresses can be added to the Student Directory.');
    }

    return withUserContext(adminUserId, async (tx) => {
      const student = await tx.authorizedStudent.upsert({
        where: { normalizedEmail },
        update: {
          status: DirectoryStatus.ACTIVE,
          updatedBy: adminUserId,
        },
        create: {
          normalizedEmail,
          status: DirectoryStatus.ACTIVE,
          createdBy: adminUserId,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: adminUserId,
          action: 'STUDENT_DIRECTORY_ADD',
          entityType: 'AuthorizedStudent',
          entityId: student.id,
          newState: { email: normalizedEmail, status: 'ACTIVE' },
        },
      });

      return student;
    });
  },

  async removeStudent(adminUserId: string, id: string) {
    return withUserContext(adminUserId, async (tx) => {
      const student = await tx.authorizedStudent.findUnique({
        where: { id },
      });

      if (!student) {
        throw new NotFoundError('Student not found in directory');
      }

      const updated = await tx.authorizedStudent.update({
        where: { id },
        data: {
          status: DirectoryStatus.REVOKED,
          updatedBy: adminUserId,
        },
      });

      // Increment securityVersion atomically if the user exists
      const user = await tx.user.findUnique({
        where: { email: student.normalizedEmail },
      });

      if (user) {
        await tx.user.update({
          where: { id: user.id },
          data: { securityVersion: { increment: 1 } },
        });
      }

      await tx.auditLog.create({
        data: {
          actorId: adminUserId,
          action: 'STUDENT_DIRECTORY_REMOVE',
          entityType: 'AuthorizedStudent',
          entityId: student.id,
          previousState: { status: student.status },
          newState: { status: 'REVOKED' },
        },
      });

      return updated;
    });
  },

  async importStudentsCsv(adminUserId: string, emails: string[]) {
    // Expected to receive a batch of normalized emails from the streaming router
    const results = {
      added: 0,
      already_present: 0,
      rejected: [] as { email: string; reason: string }[],
    };

    for (const rawEmail of emails) {
      if (!rawEmail || typeof rawEmail !== 'string') continue;
      const normalizedEmail = rawEmail.trim().toLowerCase();
      if (!normalizedEmail) continue;

      if (!normalizedEmail.endsWith('@adypu.edu.in')) {
        results.rejected.push({ email: rawEmail, reason: 'unsupported domain' });
        continue;
      }

      // Upsert student idempotently
      try {
        await withUserContext(adminUserId, async (tx) => {
          const existing = await tx.authorizedStudent.findUnique({
            where: { normalizedEmail },
          });

          if (existing && existing.status === 'ACTIVE') {
            results.already_present++;
            return;
          }

          if (existing && existing.status === 'REVOKED') {
            // Restore eligibility
            await tx.authorizedStudent.update({
              where: { normalizedEmail },
              data: { status: 'ACTIVE', updatedBy: adminUserId },
            });
            results.added++;
            return;
          }

          // Create new
          await tx.authorizedStudent.create({
            data: {
              normalizedEmail,
              status: 'ACTIVE',
              createdBy: adminUserId,
            },
          });
          results.added++;
        });
      } catch (err: any) {
        if (err.code === 'P2002') {
          results.already_present++;
        } else {
          results.rejected.push({ email: rawEmail, reason: 'database error' });
        }
      }
    }

    await withUserContext(adminUserId, async (tx) => {
      await tx.auditLog.create({
        data: {
          actorId: adminUserId,
          action: 'STUDENT_DIRECTORY_IMPORT',
          entityType: 'AuthorizedStudent',
          newState: { summary: { added: results.added, already_present: results.already_present, rejected_count: results.rejected.length } },
        },
      });
    });

    return results;
  },
};

