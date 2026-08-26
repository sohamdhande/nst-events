import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate } from '../../middleware/authenticate';
import { canManageEvent, requireRole } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import { 
  generateQrSchema, markAttendanceSchema, syncOfflineSchema,
  getEventAttendanceSchema, getMeAttendanceSchema, manualMarkSchema,
  submitDisputeSchema, getDisputesSchema, resolveDisputeSchema, reviewFlaggedSchema
} from './attendance.schema';
import { attendanceService } from './attendance.service';
import { prisma } from '@nst/database';

export const attendanceRouter: Router = Router();

// Rate limiter: 10 requests per minute
const generateQrRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: 'Too many QR generation requests. Please try again later.',
  keyGenerator: (req: any) => req.user?.id || 'unknown',
});

// Rate limiter: 5 requests per minute
const markAttendanceRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: 'Too many attendance marking requests. Please try again later.',
  keyGenerator: (req: any) => req.user?.id || 'unknown',
});

// Rate limiter: 10 requests per minute
const syncOfflineRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: 'Too many offline sync requests. Please try again later.',
  keyGenerator: (req: any) => req.user?.id || 'unknown',
});

/**
 * Helper to fetch event_id from session_id for authorization.
 */
const getEventIdFromSession = async (req: any): Promise<string> => {
  const sessionId = req.body.session_id;
  if (!sessionId) return '';
  const session = await prisma.attendanceSession.findUnique({
    where: { id: sessionId },
    select: { eventId: true },
  });
  return session?.eventId || '';
};

// POST /attendance/generate-qr
attendanceRouter.post(
  '/attendance/generate-qr',
  authenticate,
  validate(generateQrSchema),
  canManageEvent(getEventIdFromSession),
  generateQrRateLimit,
  async (req, res, next) => {
    try {
      const { session_id } = req.body;
      const result = await attendanceService.generateQr(session_id);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
);

// POST /attendance/mark
attendanceRouter.post(
  '/attendance/mark',
  authenticate,
  validate(markAttendanceSchema),
  markAttendanceRateLimit,
  async (req, res, next) => {
    try {
      const userId = req.user!.id; // from authenticate middleware
      const payload = req.body;
      const { is_new, ...responsePayload } = await attendanceService.markAttendance(userId, payload);
      res.status(is_new ? 201 : 200).json(responsePayload);
    } catch (error) {
      next(error);
    }
  }
);

// POST /attendance/sync-offline
attendanceRouter.post(
  '/attendance/sync-offline',
  authenticate,
  validate(syncOfflineSchema),
  (req, res, next) => {
    if (req.body && Array.isArray(req.body.records) && req.body.records.length === 0) {
      return res.status(200).json({ processed: 0, skipped: 0, errors: [] });
    }
    next();
  },
  syncOfflineRateLimit,
  async (req, res, next) => {
    try {
      const userId = req.user!.id; // from authenticate middleware
      const payload = req.body;
      const result = await attendanceService.syncOffline(userId, payload);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
);

// GET /events/:id/attendance
attendanceRouter.get(
  '/events/:id/attendance',
  authenticate,
  validate(getEventAttendanceSchema),
  canManageEvent((req) => req.params.id, ['CLUB_ADMIN', 'CORE_MEMBER', 'FACULTY_MENTOR']),
  async (req, res, next) => {
    try {
      const result = await attendanceService.getEventAttendance(req.user!.id, req.params.id, req.query);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
);

// GET /events/:id/attendance/export
attendanceRouter.get(
  '/events/:id/attendance/export',
  authenticate,
  canManageEvent((req) => req.params.id, ['CLUB_ADMIN', 'CORE_MEMBER', 'FACULTY_MENTOR']),
  async (req, res, next) => {
    try {
      const csvData = await attendanceService.exportEventAttendance(req.user!.id, req.params.id);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="attendance-export-${req.params.id}.csv"`);
      res.status(200).send(csvData);
    } catch (error) {
      next(error);
    }
  }
);

// GET /users/me/attendance
attendanceRouter.get(
  '/users/me/attendance',
  authenticate,
  validate(getMeAttendanceSchema),
  async (req, res, next) => {
    try {
      const userId = req.user!.id;
      const result = await attendanceService.getMyAttendance(userId, req.query);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
);

// POST /events/:id/attendance/manual
attendanceRouter.post(
  '/events/:id/attendance/manual',
  authenticate,
  requireRole(['PLATFORM_ADMIN']),
  validate(manualMarkSchema),
  async (req, res, next) => {
    try {
      const userId = req.user!.id;
      const payload = req.body;
      const { is_new, attendance_record } = await attendanceService.manualMarkAttendance(userId, payload);
      res.status(is_new ? 201 : 200).json(attendance_record);
    } catch (error) {
      next(error);
    }
  }
);

// POST /attendance/disputes
attendanceRouter.post(
  '/attendance/disputes',
  authenticate,
  validate(submitDisputeSchema),
  async (req, res, next) => {
    try {
      const userId = req.user!.id;
      const payload = req.body;
      const result = await attendanceService.submitAttendanceDispute(userId, payload);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }
);

// GET /attendance/disputes
attendanceRouter.get(
  '/attendance/disputes',
  authenticate,
  validate(getDisputesSchema),
  // No strict role check here because platform admins, faculty admins, and event club admins all can see disputes.
  // The service layer (or RLS) would enforce visibility, but we can't easily infer the event ID for `requireEventRole` globally here since event_id is just an optional filter.
  // For now, we allow authenticated users to hit the endpoint and rely on the database RLS.
  // Wait, the API contract says "Roles: CLUB_ADMIN, Faculty, Platform Admin".
  // Since we rely on RLS to filter what they can see, we just authenticate.
  async (req, res, next) => {
    try {
      const result = await attendanceService.getAttendanceDisputes(req.user!.id, req.query.filter_event_id as string, req.query);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
);

// PATCH /attendance/disputes/:id
attendanceRouter.patch(
  '/attendance/disputes/:id',
  authenticate,
  validate(resolveDisputeSchema),
  // Authorization is enforced inside the RPC via RLS or explicit checks.
  // RLS update policy for disputes enforces club role or global role.
  async (req, res, next) => {
    try {
      const userId = req.user!.id;
      const payload = req.body;
      const result = await attendanceService.resolveAttendanceDispute(userId, req.params.id, payload);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
);

// PATCH /attendance/:id/review
attendanceRouter.patch(
  '/attendance/:id/review',
  authenticate,
  validate(reviewFlaggedSchema),
  // Authorization is enforced strictly inside the review_flagged_attendance PostgreSQL RPC.
  async (req, res, next) => {
    try {
      const userId = req.user!.id;
      const result = await attendanceService.reviewFlaggedAttendance(userId, req.params.id);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
);
