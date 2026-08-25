import { Router, Request } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { requireEventRole } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import * as registrationsService from './registrations.service';
import * as teamsService from '../teams/teams.service';
import { ParamEventIdSchema, CreateTeamSchema, ListRegistrationsQuerySchema, ListTeamsQuerySchema, InviteeSearchQuerySchema } from './registrations.schema';

const router = Router();

router.post('/events/:id/register',
  authenticate,
  validate(ParamEventIdSchema),
  async (req, res, next) => {
    try {
      const result = await registrationsService.registerEvent(req.user!.id, req.params.id);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }
);

router.delete('/events/:id/register',
  authenticate,
  validate(ParamEventIdSchema),
  async (req, res, next) => {
    try {
      await registrationsService.cancelRegistration(req.user!.id, req.params.id);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
);

router.post('/events/:id/teams',
  authenticate,
  validate(CreateTeamSchema),
  async (req, res, next) => {
    try {
      const result = await teamsService.createTeam(req.user!.id, req.params.id, req.body.team_name);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }
);

router.get('/events/:id/teams',
  authenticate,
  validate(ParamEventIdSchema),
  validate(ListTeamsQuerySchema),
  async (req, res, next) => {
    try {
      const query = req.query as any;
      const result = await teamsService.listTeams(req.user!.id, req.params.id, query.limit, query.cursor);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

router.get('/events/:id/invitee-search',
  authenticate,
  validate(ParamEventIdSchema),
  validate(InviteeSearchQuerySchema),
  async (req, res, next) => {
    try {
      const query = req.query as any;
      const result = await registrationsService.searchEligibleInvitees(req.user!.id, req.params.id, query.q);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

router.get('/events/:id/registrations',
  authenticate,
  validate(ParamEventIdSchema),
  requireEventRole((req: Request) => req.params.id, ['CLUB_ADMIN', 'CORE_MEMBER']),
  validate(ListRegistrationsQuerySchema),
  async (req, res, next) => {
    try {
      const query = req.query as any;
      const result = await registrationsService.getEventRegistrations(
        req.user!.id, 
        req.params.id, 
        query.limit, 
        query.cursor, 
        query.filter_status
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

router.get('/users/me/registrations',
  authenticate,
  async (req, res, next) => {
    try {
      const result = await registrationsService.getMyRegistrations(req.user!.id);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

router.get('/events/:id/my-registration',
  authenticate,
  validate(ParamEventIdSchema),
  async (req, res, next) => {
    try {
      const result = await registrationsService.getMyRegistrationStatus(req.user!.id, req.params.id);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

export const registrationsRouter: Router = router;
