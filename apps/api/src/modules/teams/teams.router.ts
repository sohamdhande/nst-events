import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { validate } from '../../middleware/validate';
import * as teamsService from './teams.service';
import { 
  ParamTeamIdSchema, 
  CreateInvitationSchema, 
  ParamInvitationIdSchema, 
  TransferLeadershipSchema, 
  RemoveMemberSchema 
} from './teams.schema';

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

router.post('/:id/invitations',
  authenticate,
  validate(ParamTeamIdSchema),
  validate(CreateInvitationSchema),
  async (req, res, next) => {
    try {
      const result = await teamsService.inviteMember(req.user!.id, req.params.id, req.body.invitee_id);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }
);

router.post('/:id/invitations/:invitationId/accept',
  authenticate,
  validate(ParamInvitationIdSchema),
  async (req, res, next) => {
    try {
      const result = await teamsService.acceptInvitation(req.user!.id, req.params.id, req.params.invitationId);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
);

router.post('/:id/invitations/:invitationId/decline',
  authenticate,
  validate(ParamInvitationIdSchema),
  async (req, res, next) => {
    try {
      const result = await teamsService.declineInvitation(req.user!.id, req.params.id, req.params.invitationId);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
);

router.delete('/:id/invitations/:invitationId',
  authenticate,
  validate(ParamInvitationIdSchema),
  async (req, res, next) => {
    try {
      await teamsService.cancelInvitation(req.user!.id, req.params.id, req.params.invitationId);
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
