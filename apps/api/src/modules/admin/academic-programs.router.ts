import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/authorize';
import { adminAcademicProgramsService } from './academic-programs.service';

export const adminAcademicProgramsRouter: Router = Router();

// POST /v1/admin/academic-programs
adminAcademicProgramsRouter.post(
  '/',
  authenticate,
  requireRole(['PLATFORM_ADMIN', 'FACULTY_ADMIN']),
  async (req, res, next) => {
    try {
      const callerId = req.user!.id;
      const { name, code } = req.body;
      const result = await adminAcademicProgramsService.createProgram(callerId, { name, code });
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }
);

// PATCH /v1/admin/academic-programs/:programId
adminAcademicProgramsRouter.patch(
  '/:programId',
  authenticate,
  requireRole(['PLATFORM_ADMIN', 'FACULTY_ADMIN']),
  async (req, res, next) => {
    try {
      const callerId = req.user!.id;
      const programId = req.params.programId;
      const { name, code } = req.body;
      const result = await adminAcademicProgramsService.updateProgram(callerId, programId, { name, code });
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
);
