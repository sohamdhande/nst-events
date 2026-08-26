import { withUserContext } from '@nst/database';
import { ForbiddenError, ValidationError, NotFoundError } from '../../lib/errors';
// Removed GLOBAL_ADMIN_ROLES

export const academicProgramsService = {
  async getAcademicPrograms(callerId: string) {
    return withUserContext(callerId, async (tx) => {
      // 1. Authorization
      const user = await tx.user.findUnique({
        where: { id: callerId },
        select: { globalRole: true },
      });
      
      if (!user) {
        throw new ForbiddenError('User not found');
      }

      let isAuthorized = false;
      if (user.globalRole === 'PLATFORM_ADMIN') {
        isAuthorized = true;
      } else {
        const hasClubRole = await tx.clubMembership.findFirst({
          where: {
            userId: callerId,
            deletedAt: null,
            role: { in: ['CLUB_ADMIN', 'CORE_MEMBER'] },
          },
          select: { id: true },
        });
        if (hasClubRole) {
          isAuthorized = true;
        }
      }

      if (!isAuthorized) {
        throw new ForbiddenError('Unauthorized: Must be a Platform/Faculty Admin or an authorized Club organizer.');
      }

      // 2. Fetch Programs
      const programs = await tx.academicProgram.findMany({
        include: {
          _count: {
            select: { batches: true }
          }
        },
        orderBy: [
          { name: 'asc' },
        ],
      });

      // 3. Map to contract
      return programs.map(program => ({
        id: program.id,
        name: program.name,
        code: program.code,
        batchCount: program._count.batches
      }));
    });
  }
};
