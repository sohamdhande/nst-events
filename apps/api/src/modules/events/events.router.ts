import { Router, Request } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { canManageEvent, canApproveEvent, canLockEvent } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import { prisma } from '../../lib/prisma';
import { NotFoundError } from '../../lib/errors';
import * as eventsService from './events.service';
import {
  ListEventsQuerySchema,
  CreateEventSchema,
  UpdateEventSchema,
  RejectEventSchema,
  CreateSessionSchema,
  UpdateSessionSchema,
} from './events.schema';
import { CreateTeamSchema } from '../teams/teams.schema';
import * as teamsService from '../teams/teams.service';
import { z } from 'zod';

const ParamIdSchema = z.object({
  params: z.object({ id: z.string().uuid() }).passthrough(),
}).passthrough();
const ParamSessionIdSchema = z.object({
  params: z.object({ id: z.string().uuid(), sessionId: z.string().uuid() }).passthrough(),
}).passthrough();
const ParamEventTeamIdSchema = z.object({
  params: z.object({ id: z.string().uuid(), teamId: z.string().uuid() }).passthrough(),
}).passthrough();

const router = Router();

// ==========================================
// CRUD Routes
// ==========================================

router.get(
  '/',
  authenticate,
  validate(ListEventsQuerySchema),
  async (req, res, next) => {
    try {
      const result = await eventsService.listEvents(req.user!.id, req.query as any);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/:id',
  authenticate,
  validate(ParamIdSchema),
  async (req, res, next) => {
    try {
      const event = await eventsService.getEventById(req.user!.id, req.params.id);
      res.json(event);
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/',
  authenticate,
  validate(CreateEventSchema),
  async (req, res, next) => {
    try {
      const event = await eventsService.createEvent(req.user!.id, req.body);
      res.status(201).json(event);
    } catch (err) {
      next(err);
    }
  }
);

router.patch(
  '/:id',
  authenticate,
  validate(ParamIdSchema),
  canManageEvent((req: Request) => req.params.id),
  validate(UpdateEventSchema),
  async (req, res, next) => {
    try {
      const event = await eventsService.updateEvent(req.user!.id, req.params.id, req.body);
      res.json(event);
    } catch (err) {
      next(err);
    }
  }
);

router.delete(
  '/:id',
  authenticate,
  validate(ParamIdSchema),
  canManageEvent((req: Request) => req.params.id, ['CLUB_ADMIN']),
  async (req, res, next) => {
    try {
      await eventsService.deleteEvent(req.user!.id, req.params.id);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
);

// ==========================================
// State Transition Routes
// ==========================================

router.post(
  '/:id/submit-for-approval',
  authenticate,
  validate(ParamIdSchema),
  canManageEvent((req: Request) => req.params.id),
  async (req, res, next) => {
    try {
      const result = await eventsService.submitForApproval(req.user!.id, req.params.id);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/:id/approve',
  authenticate,
  validate(ParamIdSchema),
  canApproveEvent((req: Request) => req.params.id),
  async (req, res, next) => {
    try {
      const result = await eventsService.approveEvent(req.user!.id, req.params.id);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/:id/reject',
  authenticate,
  validate(ParamIdSchema),
  canApproveEvent((req: Request) => req.params.id),
  validate(RejectEventSchema),
  async (req, res, next) => {
    try {
      const result = await eventsService.rejectEvent(
        req.user!.id,
        req.params.id,
        req.body.rejection_reason
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/:id/lock',
  authenticate,
  validate(ParamIdSchema),
  canLockEvent((req: Request) => req.params.id),
  async (req, res, next) => {
    try {
      const result = await eventsService.lockEvent(req.user!.id, req.params.id);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/:id/unlock',
  authenticate,
  validate(ParamIdSchema),
  canLockEvent((req: Request) => req.params.id),
  async (req, res, next) => {
    try {
      const result = await eventsService.unlockEvent(req.user!.id, req.params.id);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

// ==========================================
// Session Routes
// ==========================================

router.get(
  '/:id/teams',
  authenticate,
  validate(ParamIdSchema),
  async (req, res, next) => {
    try {
      const teams = await teamsService.listTeams(req.user!.id, req.params.id, 50, req.query.cursor as string);
      res.json(teams);
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/:id/teams',
  authenticate,
  validate(CreateTeamSchema),
  async (req, res, next) => {
    try {
      const team = await teamsService.createTeam(req.user!.id, req.params.id, req.body.team_name);
      res.status(201).json(team);
    } catch (err) {
      next(err);
    }
  }
);



// ==========================================
// Session Routes
// ==========================================

router.get(
  '/:id/sessions',
  authenticate,
  validate(ParamIdSchema),
  async (req, res, next) => {
    try {
      const sessions = await eventsService.listSessions(req.user!.id, req.params.id);
      res.json(sessions);
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/:id/sessions',
  authenticate,
  validate(ParamIdSchema),
  canManageEvent((req: Request) => req.params.id),
  validate(CreateSessionSchema),
  async (req, res, next) => {
    try {
      const session = await eventsService.createSession(req.user!.id, req.params.id, req.body);
      res.status(201).json(session);
    } catch (err) {
      next(err);
    }
  }
);

router.patch(
  '/:id/sessions/:sessionId',
  authenticate,
  validate(ParamSessionIdSchema),
  canManageEvent((req: Request) => req.params.id),
  validate(UpdateSessionSchema),
  async (req, res, next) => {
    try {
      const session = await eventsService.updateSession(
        req.user!.id,
        req.params.id,
        req.params.sessionId,
        req.body
      );
      res.json(session);
    } catch (err) {
      next(err);
    }
  }
);

export const eventsRouter: Router = router;
