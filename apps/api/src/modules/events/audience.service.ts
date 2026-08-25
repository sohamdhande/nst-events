import { PrismaClient, Prisma } from '@nst/database';
import { prisma } from '../../lib/prisma';
import { ForbiddenError, NotFoundError } from '../../lib/errors';

export const checkAudienceEligibility = async (eventId: string, userId: string, tx?: Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">): Promise<boolean> => {
  const db = tx || prisma;

  const event = await db.event.findUnique({
    where: { id: eventId },
    select: { audience: true }
  });

  if (!event) throw new NotFoundError('Event not found');

  if (event.audience === 'ALL_STUDENTS') {
    return true;
  }

  const profile = await db.userAcademicProfile.findUnique({
    where: { userId },
    select: { batchId: true }
  });

  if (!profile || !profile.batchId) {
    throw new ForbiddenError('AUDIENCE_NOT_ELIGIBLE');
  }

  const isEligible = await db.eventAudienceBatch.findUnique({
    where: {
      eventId_batchId: {
        eventId,
        batchId: profile.batchId
      }
    }
  });

  if (!isEligible) {
    throw new ForbiddenError('AUDIENCE_NOT_ELIGIBLE');
  }

  return true;
};
