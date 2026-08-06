import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import { DeadLetterQuerySchema } from './queue.schema';
import * as queueService from './queue.service';

const router = Router();

router.get('/queue/monitoring', authenticate, requireRole(['PLATFORM_ADMIN']), async (req, res, next) => {
  try {
    const stats = await queueService.getQueueMonitoringStats();
    res.json(stats);
  } catch (err) {
    next(err);
  }
});

router.get('/queue/dead-letters', authenticate, requireRole(['PLATFORM_ADMIN']), validate(DeadLetterQuerySchema), async (req, res, next) => {
  try {
    const result = await queueService.getDeadLetters(req.query);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/queue/dead-letters/:id/replay', authenticate, requireRole(['PLATFORM_ADMIN']), async (req, res, next) => {
  try {
    const result = await queueService.replayDeadLetter(req.user!.id, req.params.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export const adminQueueRouter: Router = router;
