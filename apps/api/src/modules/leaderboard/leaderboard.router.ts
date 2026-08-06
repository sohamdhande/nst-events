import { Router } from 'express';
import { validate } from '../../middleware/validate';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/authorize';
import { getLeaderboardSchema } from './leaderboard.schema';
import { leaderboardService } from './leaderboard.service';

export const leaderboardRouter: Router = Router();

leaderboardRouter.get('/students', authenticate, validate(getLeaderboardSchema), async (req, res, next) => {
  try {
    const result = await leaderboardService.getStudentLeaderboard(req.query as any);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

leaderboardRouter.get('/clubs', authenticate, validate(getLeaderboardSchema), async (req, res, next) => {
  try {
    const result = await leaderboardService.getClubLeaderboard(req.query as any);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export const adminLeaderboardRouter: Router = Router();

adminLeaderboardRouter.post('/recalculate', authenticate, requireRole(['PLATFORM_ADMIN']), async (_req, res, next) => {
  try {
    const result = await leaderboardService.refreshLeaderboards();
    res.json(result);
  } catch (err) {
    next(err);
  }
});
