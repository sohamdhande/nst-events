import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/authorize';
import { adminAcademicBatchesService } from './academic-batches.service';

export const adminAcademicBatchesRouter: Router = Router();

// POST /v1/admin/academic-batches
adminAcademicBatchesRouter.post(
  '/',
  authenticate,
  requireRole(['PLATFORM_ADMIN']),
  async (req, res, next) => {
    try {
      const callerId = req.user!.id;
      const { program_id, admission_year, graduation_year } = req.body;
      const result = await adminAcademicBatchesService.createBatch(callerId, {
        programId: program_id,
        admissionYear: admission_year,
        graduationYear: graduation_year,
      });
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }
);

// PATCH /v1/admin/academic-batches/:batchId
adminAcademicBatchesRouter.patch(
  '/:batchId',
  authenticate,
  requireRole(['PLATFORM_ADMIN']),
  async (req, res, next) => {
    try {
      const callerId = req.user!.id;
      const batchId = req.params.batchId;
      const { admission_year, graduation_year } = req.body; // program_id change not allowed according to general identity preservation rule
      const result = await adminAcademicBatchesService.updateBatch(callerId, batchId, {
        admissionYear: admission_year,
        graduationYear: graduation_year,
      });
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
);
