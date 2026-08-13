import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { dashboardService } from './dashboard.service';

export const dashboardRouter: Router = Router();

// GET /v1/dashboard/summary
dashboardRouter.get(
  '/summary',
  authenticate,
  async (req, res, next) => {
    try {
      const userId = req.user!.id;
      const result = await dashboardService.getSummary(userId);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
);
