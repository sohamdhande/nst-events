import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { validate } from '../../middleware/validate';
import * as teamsService from './teams.service';
import { 
  ParamTeamIdSchema,
  TransferLeadershipSchema, 
  RemoveMemberSchema 
} from './teams.schema';

const router = Router();

router.get('/:id',
  authenticate,
  validate(ParamTeamIdSchema),
  async (req, res, next) => {
    try {
      const result = await teamsService.getTeamById(req.user!.id, req.params.id);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
);

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



router.post('/:id/transfer-leadership',
  authenticate,
  validate(ParamTeamIdSchema),
  validate(TransferLeadershipSchema),
  async (req, res, next) => {
    try {
      const result = await teamsService.transferLeadership(req.user!.id, req.params.id, req.body.new_leader_id);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
);

router.delete('/:id/members/:userId',
  authenticate,
  validate(RemoveMemberSchema),
  async (req, res, next) => {
    try {
      await teamsService.removeMember(req.user!.id, req.params.id, req.params.userId);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
);

export const teamsRouter: Router = router;
