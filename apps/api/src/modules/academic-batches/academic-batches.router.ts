import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { academicBatchesService } from './academic-batches.service';

export const academicBatchesRouter: Router = Router();

// GET /v1/academic-batches
academicBatchesRouter.get(
  '/',
  authenticate,
  async (req, res, next) => {
    try {
      const callerId = req.user!.id;
      const result = await academicBatchesService.getAcademicBatches(callerId);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
);
