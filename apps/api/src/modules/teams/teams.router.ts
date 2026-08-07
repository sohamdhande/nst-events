import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { validate } from '../../middleware/validate';
import * as teamsService from './teams.service';
import { ParamTeamIdSchema } from './teams.schema';

const router = Router();

router.post('/:id/join',
  authenticate,
  validate(ParamTeamIdSchema),
  async (req, res, next) => {
    try {
      const result = await teamsService.joinTeam(req.user!.id, req.params.id);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }
);

router.delete('/:id/leave',
  authenticate,
  validate(ParamTeamIdSchema),
  async (req, res, next) => {
    try {
      await teamsService.leaveTeam(req.user!.id, req.params.id);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
);

export const teamsRouter: Router = router;
