import { Router, Request } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { canManageEvent } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import * as adminTeamsService from './teams.service';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';

const getEventIdFromTeam = async (req: Request) => {
  const team = await prisma.team.findUnique({ where: { id: req.params.id }, select: { eventId: true } });
  return team?.eventId || '';
};

const ParamTeamIdSchema = z.object({
  params: z.object({ id: z.string().uuid() }).passthrough(),
}).passthrough();

const TransferLeadershipSchema = z.object({
  params: z.object({ id: z.string().uuid() }).passthrough(),
  body: z.object({ new_leader_id: z.string().uuid() })
}).passthrough();

const RemoveMemberSchema = z.object({
  params: z.object({ id: z.string().uuid(), userId: z.string().uuid() }).passthrough(),
}).passthrough();

const router = Router();

router.post('/:id/promote-waitlist',
  authenticate,
  validate(ParamTeamIdSchema),
  canManageEvent(getEventIdFromTeam, ['CLUB_ADMIN']),
  async (req, res, next) => {
    try {
      const result = await adminTeamsService.manualWaitlistPromotion(req.user!.id, req.params.id);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
);

router.post('/:id/cancel',
  authenticate,
  validate(ParamTeamIdSchema),
  canManageEvent(getEventIdFromTeam, ['CLUB_ADMIN']),
  async (req, res, next) => {
    try {
      const result = await adminTeamsService.cancelTeam(req.user!.id, req.params.id);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
);

router.delete('/:id/members/:userId',
  authenticate,
  validate(RemoveMemberSchema),
  canManageEvent(getEventIdFromTeam, ['CLUB_ADMIN']),
  async (req, res, next) => {
    try {
      await adminTeamsService.removeMember(req.user!.id, req.params.id, req.params.userId);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
);

router.post('/:id/transfer-leadership',
  authenticate,
  validate(TransferLeadershipSchema),
  canManageEvent(getEventIdFromTeam, ['CLUB_ADMIN']),
  async (req, res, next) => {
    try {
      const result = await adminTeamsService.transferLeadership(req.user!.id, req.params.id, req.body.new_leader_id);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
);

const CancelInvitationSchema = z.object({
  params: z.object({ id: z.string().uuid(), invitationId: z.string().uuid() }).passthrough(),
}).passthrough();

router.get('/:id/invitations',
  authenticate,
  validate(ParamTeamIdSchema),
  canManageEvent(getEventIdFromTeam, ['CLUB_ADMIN']),
  async (req, res, next) => {
    try {
      const result = await adminTeamsService.getSentTeamInvitations(req.user!.id, req.params.id);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
);

router.delete('/:id/invitations/:invitationId',
  authenticate,
  validate(CancelInvitationSchema),
  canManageEvent(getEventIdFromTeam, ['CLUB_ADMIN']),
  async (req, res, next) => {
    try {
      await adminTeamsService.cancelInvitation(req.user!.id, req.params.id, req.params.invitationId);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
);

export const adminTeamsRouter: Router = router;
