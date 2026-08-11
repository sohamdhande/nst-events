import { Router } from 'express';
import { prisma } from '../../lib/prisma';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/authorize';

export const adminUsersRouter = Router();

// POST /v1/admin/users/:userId/revoke-sessions
adminUsersRouter.post(
  '/:userId/revoke-sessions',
  authenticate,
  requireRole(['PLATFORM_ADMIN']),
  async (req, res, next) => {
    try {
      const { userId } = req.params;
      const result = await prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      res.json({ message: 'Sessions revoked', revoked_count: result.count });
    } catch (err) {
      next(err);
    }
  }
);
