import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { validate } from '../../middleware/validate';
import { GetNotificationsQuerySchema, UpdatePreferencesSchema } from './notifications.schema';
import * as notificationsService from './notifications.service';

const router = Router();

router.get(
  '/',
  authenticate,
  validate(GetNotificationsQuerySchema),
  async (req, res, next) => {
    try {
      // req.query is validated and coerced by Zod
      const result = await notificationsService.getNotifications(req.user!.id, req.query as any);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/unread-count',
  authenticate,
  async (req, res, next) => {
    try {
      const result = await notificationsService.getUnreadCount(req.user!.id);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
);

router.patch(
  '/read-all',
  authenticate,
  async (req, res, next) => {
    try {
      await notificationsService.markAllAsRead(req.user!.id);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
);

router.patch(
  '/:id/read',
  authenticate,
  async (req, res, next) => {
    try {
      const result = await notificationsService.markAsRead(req.user!.id, req.params.id);
      if (!result) {
        return res.status(404).json({ error: 'Notification not found' });
      }
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/preferences',
  authenticate,
  async (req, res, next) => {
    try {
      const result = await notificationsService.getPreferences(req.user!.id);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
);

router.patch(
  '/preferences',
  authenticate,
  validate(UpdatePreferencesSchema),
  async (req, res, next) => {
    try {
      const result = await notificationsService.updatePreferences(req.user!.id, req.body);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
);

export const notificationsRouter: Router = router;
