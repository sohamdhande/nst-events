import { Router } from 'express';
import { prisma } from '../../lib/prisma';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import { listAdminUsersSchema, updateAdminUserRoleSchema, updateAcademicBatchSchema, provisionUserSchema } from './users.schema';
import { adminUsersService } from './users.service';

export const adminUsersRouter: Router = Router();

// GET /v1/admin/users
adminUsersRouter.get(
  '/',
  authenticate,
  requireRole(['PLATFORM_ADMIN', 'FACULTY_ADMIN']),
  validate(listAdminUsersSchema),
  async (req, res, next) => {
    try {
      const result = await adminUsersService.listUsers(req.query as any);
      res.status(200).json(result);
    } catch (err) {
      console.error("ADMIN_BATCH_ERR:", err); next(err);
    }
  }
);

// GET /v1/admin/users/:userId
adminUsersRouter.get(
  '/:userId',
  authenticate,
  requireRole(['PLATFORM_ADMIN', 'FACULTY_ADMIN']),
  async (req, res, next) => {
    try {
      const result = await adminUsersService.getUser(req.params.userId);
      res.status(200).json(result);
    } catch (err) {
      console.error("ADMIN_USER_GET_ERR:", err); next(err);
    }
  }
);

// POST /v1/admin/users/:userId/role
adminUsersRouter.post(
  '/:userId/role',
  authenticate,
  requireRole(['PLATFORM_ADMIN']),
  validate(updateAdminUserRoleSchema),
  async (req, res, next) => {
    try {
      const adminId = req.user!.id;
      const targetId = req.params.userId;
      const payload = req.body;
      const result = await adminUsersService.updateUserRole(adminId, targetId, payload);
      res.status(200).json(result);
    } catch (err) {
      console.error("ADMIN_BATCH_ERR:", err); next(err);
    }
  }
);

// POST /v1/admin/users/provision
adminUsersRouter.post(
  '/provision',
  authenticate,
  requireRole(['PLATFORM_ADMIN']),
  validate(provisionUserSchema),
  async (req, res, next) => {
    try {
      const adminId = req.user!.id;
      const result = await adminUsersService.provisionUser(adminId, req.body);
      res.status(200).json(result);
    } catch (err) {
      console.error("ADMIN_PROVISION_ERR:", err); next(err);
    }
  }
);

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
      console.error("ADMIN_BATCH_ERR:", err); next(err);
    }
  }
);

// PATCH /v1/admin/users/:userId/academic-batch
adminUsersRouter.patch(
  '/:userId/academic-batch',
  authenticate,
  requireRole(['PLATFORM_ADMIN', 'FACULTY_ADMIN']),
  validate(updateAcademicBatchSchema),
  async (req, res, next) => {
    try {
      const adminId = req.user!.id;
      const targetId = req.params.userId;
      const payload = req.body;
      const result = await adminUsersService.updateAcademicBatch(adminId, targetId, payload);
      res.status(200).json(result);
    } catch (err) {
      console.error("ADMIN_BATCH_ERR:", err); next(err);
    }
  }
);
