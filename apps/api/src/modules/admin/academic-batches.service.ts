import { withUserContext } from '@nst/database';
import { ValidationError, ConflictError, NotFoundError } from '../../lib/errors';

export const adminAcademicBatchesService = {
  async createBatch(callerId: string, data: { programId: string; admissionYear: number; graduationYear: number }) {
    if (!data.programId || !data.admissionYear || !data.graduationYear) {
      throw new ValidationError('Program ID, admission year, and graduation year are required');
    }

    if (data.graduationYear <= data.admissionYear) {
      throw new ValidationError('Graduation year must be greater than admission year');
    }

    return withUserContext(callerId, async (tx) => {
      const program = await tx.academicProgram.findUnique({
        where: { id: data.programId },
      });
      if (!program) {
        throw new NotFoundError('Program not found');
      }

      const existing = await tx.academicBatch.findUnique({
        where: {
          programId_admissionYear_graduationYear: {
            programId: data.programId,
            admissionYear: data.admissionYear,
            graduationYear: data.graduationYear,
          },
        },
      });
      if (existing) {
        throw new ConflictError('A batch for this program and year combination already exists');
      }

      const batch = await tx.academicBatch.create({
        data: {
          programId: data.programId,
          admissionYear: data.admissionYear,
          graduationYear: data.graduationYear,
        },
        include: {
          program: true,
        },
      });

      // Write Audit Log
      await tx.auditLog.create({
        data: {
          action: 'CREATE_ACADEMIC_BATCH',
          actorId: callerId,
          entityType: 'AcademicBatch',
          entityId: batch.id,
          newState: {
            programId: batch.programId,
            admissionYear: batch.admissionYear,
            graduationYear: batch.graduationYear,
          },
        },
      });

      return {
        id: batch.id,
        program: {
          id: batch.program.id,
          name: batch.program.name,
          code: batch.program.code,
        },
        admission_year: batch.admissionYear,
        graduation_year: batch.graduationYear,
        display_name: `${batch.program.name} — ${batch.admissionYear}–${batch.graduationYear}`,
      };
    });
  },

  async updateBatch(callerId: string, batchId: string, data: { admissionYear?: number; graduationYear?: number }) {
    return withUserContext(callerId, async (tx) => {
      const existing = await tx.academicBatch.findUnique({
        where: { id: batchId },
        include: { program: true },
      });
      if (!existing) {
        throw new NotFoundError('Batch not found');
      }

      const newAdmissionYear = data.admissionYear ?? existing.admissionYear;
      const newGraduationYear = data.graduationYear ?? existing.graduationYear;

      if (newGraduationYear <= newAdmissionYear) {
        throw new ValidationError('Graduation year must be greater than admission year');
      }

      // Check conflict if changing years
      if (newAdmissionYear !== existing.admissionYear || newGraduationYear !== existing.graduationYear) {
        const conflict = await tx.academicBatch.findUnique({
          where: {
            programId_admissionYear_graduationYear: {
              programId: existing.programId,
              admissionYear: newAdmissionYear,
              graduationYear: newGraduationYear,
            },
          },
        });
        if (conflict) {
          throw new ConflictError('A batch for this program and year combination already exists');
        }
      }

      const updated = await tx.academicBatch.update({
        where: { id: batchId },
        data: {
          admissionYear: newAdmissionYear,
          graduationYear: newGraduationYear,
        },
        include: {
          program: true,
        },
      });

      // Write Audit Log
      await tx.auditLog.create({
        data: {
          action: 'UPDATE_ACADEMIC_BATCH',
          actorId: callerId,
          entityType: 'AcademicBatch',
          entityId: updated.id,
          previousState: {
            programId: existing.programId,
            admissionYear: existing.admissionYear,
            graduationYear: existing.graduationYear,
          },
          newState: {
            programId: updated.programId,
            admissionYear: updated.admissionYear,
            graduationYear: updated.graduationYear,
          },
        },
      });

      return {
        id: updated.id,
        program: {
          id: updated.program.id,
          name: updated.program.name,
          code: updated.program.code,
        },
        admission_year: updated.admissionYear,
        graduation_year: updated.graduationYear,
        display_name: `${updated.program.name} — ${updated.admissionYear}–${updated.graduationYear}`,
      };
    });
  },
};
