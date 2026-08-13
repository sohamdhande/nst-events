import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import { listAuditLogsSchema } from './audit-logs.schema';
import { auditLogsService } from './audit-logs.service';

export const adminAuditLogsRouter: Router = Router();

// GET /v1/admin/audit-logs
adminAuditLogsRouter.get(
  '/',
  authenticate,
  requireRole(['PLATFORM_ADMIN']),
  validate(listAuditLogsSchema),
  async (req, res, next) => {
    try {
      const result = await auditLogsService.listLogs(req.query as any);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
);
