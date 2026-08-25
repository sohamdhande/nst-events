import { withUserContext } from '@nst/database';
import { ValidationError, ConflictError, NotFoundError } from '../../lib/errors';

export const adminAcademicProgramsService = {
  async createProgram(callerId: string, data: { name: string; code: string }) {
    if (!data.name || !data.code) {
      throw new ValidationError('Name and code are required');
    }

    return withUserContext(callerId, async (tx) => {
      const existing = await tx.academicProgram.findUnique({
        where: { code: data.code },
      });
      if (existing) {
        throw new ConflictError('A program with this code already exists');
      }

      const program = await tx.academicProgram.create({
        data: {
          name: data.name,
          code: data.code,
        },
      });

      // Write Audit Log
      await tx.auditLog.create({
        data: {
          action: 'CREATE_ACADEMIC_PROGRAM',
          actorId: callerId,
          entityType: 'AcademicProgram',
          entityId: program.id,
          newState: { name: program.name, code: program.code },
        },
      });

      return {
        id: program.id,
        name: program.name,
        code: program.code,
        batchCount: 0,
      };
    });
  },

  async updateProgram(callerId: string, programId: string, data: { name?: string; code?: string }) {
    return withUserContext(callerId, async (tx) => {
      const existing = await tx.academicProgram.findUnique({
        where: { id: programId },
        include: { _count: { select: { batches: true } } },
      });
      if (!existing) {
        throw new NotFoundError('Program not found');
      }

      if (data.code && data.code !== existing.code) {
        const codeConflict = await tx.academicProgram.findUnique({
          where: { code: data.code },
        });
        if (codeConflict) {
          throw new ConflictError('A program with this code already exists');
        }
      }

      const updated = await tx.academicProgram.update({
        where: { id: programId },
        data: {
          ...(data.name ? { name: data.name } : {}),
          ...(data.code ? { code: data.code } : {}),
        },
      });

      // Write Audit Log
      await tx.auditLog.create({
        data: {
          action: 'UPDATE_ACADEMIC_PROGRAM',
          actorId: callerId,
          entityType: 'AcademicProgram',
          entityId: updated.id,
          previousState: { name: existing.name, code: existing.code },
          newState: { name: updated.name, code: updated.code },
        },
      });

      return {
        id: updated.id,
        name: updated.name,
        code: updated.code,
        batchCount: existing._count.batches,
      };
    });
  },
};
