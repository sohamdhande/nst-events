import { withUserContext } from '@nst/database';
import { ForbiddenError } from '../../lib/errors';
import { GLOBAL_ADMIN_ROLES } from '../../middleware/authorize';

export const academicBatchesService = {
  async getAcademicBatches(callerId: string) {
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
      if (GLOBAL_ADMIN_ROLES.includes(user.globalRole)) {
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

      // 2. Fetch Batches
      const batches = await tx.academicBatch.findMany({
        include: {
          program: true,
        },
        orderBy: [
          { program: { name: 'asc' } },
          { admissionYear: 'asc' },
          { graduationYear: 'asc' },
        ],
      });

      // 3. Map to contract
      return batches.map(batch => ({
        id: batch.id,
        program: {
          id: batch.program.id,
          name: batch.program.name,
          code: batch.program.code,
        },
        admission_year: batch.admissionYear,
        graduation_year: batch.graduationYear,
        display_name: `${batch.program.name} — ${batch.admissionYear}–${batch.graduationYear}`
      }));
    });
  }
};
