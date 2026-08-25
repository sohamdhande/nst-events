import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { validate } from '../../middleware/validate';
import { RegisterPushTokenSchema, UpdateProfileSchema } from './users.schema';
import * as usersService from './users.service';

const router = Router();

router.get('/me', authenticate, async (req, res, next) => {
  try {
    console.error("GET ME USER ID:", req.user!.id); const user = await usersService.getMe(req.user!.id); console.error("GET ME RETURNED:", user);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (err) {
    next(err);
  }
});

router.get('/me/team-invitations', authenticate, async (req, res, next) => {
  try {
    const invitations = await usersService.getPendingTeamInvitations(req.user!.id);
    res.json(invitations);
  } catch (err) {
    next(err);
  }
});

router.patch(
  '/me',
  authenticate,
  validate(UpdateProfileSchema),
  async (req, res, next) => {
    try {
      const user = await usersService.updateMe(req.user!.id, req.body);
      res.json(user);
    } catch (err) {
      next(err);
    }
  }
);

router.get('/:id/profile', authenticate, async (req, res, next) => {
  try {
    const user = await usersService.getPublicProfile(req.user!.id, req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (err) {
    next(err);
  }
});

router.post(
  '/me/push-token',
  authenticate,
  validate(RegisterPushTokenSchema),
  async (req, res, next) => {
    try {
      const result = await usersService.registerPushToken(req.user!.id, req.body);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
);

export const usersRouter: Router = router;
