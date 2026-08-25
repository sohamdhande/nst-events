import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { academicProgramsService } from './academic-programs.service';

export const academicProgramsRouter: Router = Router();

// GET /v1/academic-programs
academicProgramsRouter.get(
  '/',
  authenticate,
  async (req, res, next) => {
    try {
      const callerId = req.user!.id;
      const result = await academicProgramsService.getAcademicPrograms(callerId);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
);
