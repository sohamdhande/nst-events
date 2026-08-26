import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { requireRole, requireClubRole } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import { ConflictError } from '../../lib/errors';
import {
  CreateClubSchema,
  UpdateClubSchema,
  UpdateClubStatusSchema,
  AddMemberSchema,
  UpdateMemberRoleSchema,
  ListClubsQuerySchema,
} from './clubs.schema';
import * as clubsService from './clubs.service';

const router = Router();

// GET /search is routed here for now, as clubs is the only supported type
router.get('/search', authenticate, validate(ListClubsQuerySchema), async (req, res, next) => {
  try {
    const q = req.query.q as string | undefined;
    const type = req.query.type as string | undefined;
    const cursor = req.query.cursor as string | undefined;
    const limit = parseInt((req.query.limit as string) || '20', 10);

    if (type && type !== 'clubs') {
      return res.status(400).json({ error: 'Only type=clubs is supported currently' });
    }

    if (!q) {
      return res.json({ data: [], pagination: { next_cursor: null, has_more: false } });
    }

    const result = await clubsService.searchClubs(req.user!.id, q, { cursor, limit });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/', authenticate, validate(ListClubsQuerySchema), async (req, res, next) => {
  try {
    const cursor = req.query.cursor as string | undefined;
    const limit = parseInt((req.query.limit as string) || '20', 10);
    const sort = req.query.sort as 'name' | 'created_at';
    const order = req.query.order as 'asc' | 'desc';

    const result = await clubsService.getClubs(req.user!.id, {
      cursor,
      limit,
      sort,
      order,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const club = await clubsService.getClub(req.user!.id, req.params.id);
    if (!club) {
      return res.status(404).json({ error: 'Club not found' });
    }
    res.json(club);
  } catch (err) {
    next(err);
  }
});

router.post(
  '/',
  authenticate,
  requireRole(['PLATFORM_ADMIN']),
  validate(CreateClubSchema),
  async (req, res, next) => {
    try {
      const club = await clubsService.createClub(req.user!.id, req.body);
      res.status(201).json({ id: club.id, name: club.name, status: club.status });
    } catch (err) {
      next(err);
    }
  }
);

router.patch(
  '/:id',
  authenticate,
  requireClubRole((req) => req.params.id, ['CLUB_ADMIN']),
  validate(UpdateClubSchema),
  async (req, res, next) => {
    try {
      const club = await clubsService.updateClub(req.user!.id, req.params.id, req.body);
      if (!club) {
        return res.status(404).json({ error: 'Club not found' });
      }
      res.json(club);
    } catch (err) {
      next(err);
    }
  }
);

router.patch(
  '/:id/status',
  authenticate,
  requireRole(['PLATFORM_ADMIN']),
  validate(UpdateClubStatusSchema),
  async (req, res, next) => {
    try {
      const club = await clubsService.updateClubStatus(
        req.user!.id,
        req.params.id,
        req.body.status
      );
      if (!club) {
        return res.status(404).json({ error: 'Club not found' });
      }
      res.json(club);
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/:id/members',
  authenticate,
  requireClubRole((req) => req.params.id, [
    'CLUB_ADMIN',
  ]),
  validate(AddMemberSchema),
  async (req, res, next) => {
    try {
      const member = await clubsService.addMember(
        req.user!.id,
        req.params.id,
        req.body.user_id,
        req.body.role
      );
      res.status(201).json(member);
    } catch (err: any) {
      if (err.message === 'P2002') {
        next(new ConflictError('User already a member'));
      } else {
        next(err);
      }
    }
  }
);

router.patch(
  '/:id/members/:userId',
  authenticate,
  requireClubRole((req) => req.params.id, [
    'CLUB_ADMIN',
    'FACULTY_MENTOR',
  ]),
  validate(UpdateMemberRoleSchema),
  async (req, res, next) => {
    try {
      const member = await clubsService.updateMemberRole(
        req.user!.id,
        req.params.id,
        req.params.userId,
        req.body.role
      );
      if (!member) {
        return res.status(404).json({ error: 'Membership not found' });
      }
      res.json(member);
    } catch (err) {
      next(err);
    }
  }
);

router.delete(
  '/:id/members/:userId',
  authenticate,
  requireClubRole((req) => req.params.id, [
    'CLUB_ADMIN',
  ]),
  async (req, res, next) => {
    try {
      const deleted = await clubsService.removeMember(
        req.user!.id,
        req.params.id,
        req.params.userId
      );
      if (!deleted) {
        return res.status(404).json({ error: 'Membership not found' });
      }
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
);

export const clubsRouter: Router = router;
