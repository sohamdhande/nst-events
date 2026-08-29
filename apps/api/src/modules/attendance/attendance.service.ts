import { prisma, withUserContext } from '@nst/database';
import { generateQrPayload, verifyQrPayload } from './totp.utils';
import { UnprocessableEntityError, ConflictError, ForbiddenError, NotFoundError, BadRequestError } from '../../lib/errors';
import { sanitizeOfflineError } from './attendance-error-mapper';
import { mapDatabaseError } from '../../lib/errors/database-error-mapper';
import { SCORE_RULES } from '../../config/score-rules';
import { enqueueNotification } from '../notifications/notifications.producer';

export class AttendanceService {
  /**
   * Generates a new TOTP QR payload.
   */
  async generateQr(userId: string, sessionId: string) {
    return withUserContext(userId, async (tx) => {
      const session = await tx.attendanceSession.findUnique({
        where: { id: sessionId },
        select: { 
          qrSecret: true,
          event: { select: { isLocked: true, endTime: true } }
        },
      });

      if (!session) {
        throw new Error('Session not found');
      }

      const dbTimeResult = await tx.$queryRaw<{ now: Date }[]>`SELECT now() as now`;
      const dbNow = dbTimeResult[0].now;
      const finalDeadline = new Date(session.event.endTime.getTime() + 24 * 60 * 60 * 1000);
      
      if (session.event.isLocked || dbNow >= finalDeadline) {
        throw new UnprocessableEntityError('EVENT_LOCKED');
      }

      const qr_payload = generateQrPayload(sessionId, session.qrSecret);
      // Expires at the end of the current 15-second window.
      const expires_at = new Date(Math.ceil(Date.now() / 15000) * 15000).toISOString();
      return { qr_payload, expires_at };
    });
  }

  /**
   * Cryptographically validates the QR, then calls the database RPC.
   */
  async markAttendance(
    userId: string,
    payload: {
      session_id: string;
      totp_token: string;
      latitude: number;
      longitude: number;
      device_id: string;
      device_os: string;
      gps_accuracy: number;
      mock_location_detected: boolean;
      app_version: string;
    }
  ) {
    try {
      return await withUserContext(userId, async (tx) => {
        // 1. Cryptographic Validation (Express level)
        const sessionContext = await tx.$queryRaw<any[]>`
          SELECT * FROM get_session_qr_context(${payload.session_id}::uuid)
        `;

        if (!sessionContext || sessionContext.length === 0) {
          throw new UnprocessableEntityError('SESSION_CLOSED');
        }

        const session = sessionContext[0];

        const now = new Date();
        if (now < session.open_at || (session.close_at && now > session.close_at)) {
          throw new UnprocessableEntityError('SESSION_CLOSED');
        }

        const isValid = verifyQrPayload(payload.session_id, payload.totp_token, session.qr_secret);
        if (!isValid) {
          throw new UnprocessableEntityError('QR_EXPIRED');
        }

        // 2. Database RPC Invocation
        // 2a. Guard against QR relay attacks by making the signature single-use.
        // This MUST be the first operation after validation so we fail fast.
        const parts = payload.totp_token.split(':');
        const signature = parts[2];

        try {
          await tx.consumedQrSignature.create({
            data: {
              sessionId: payload.session_id,
              signature,
            },
          });
        } catch (e: any) {
          if (e.code === 'P2002') {
            throw new ConflictError('This QR code has already been used');
          }
          throw e;
        }

        const result = await tx.$queryRaw<any[]>`
          WITH rpc AS (
            SELECT * FROM mark_attendance_v5(
              ${payload.session_id}::uuid,
              ${payload.totp_token},
              ${payload.latitude}::float,
              ${payload.longitude}::float,
              ${payload.device_id},
              ${payload.device_os},
              ${payload.gps_accuracy}::float,
              ${payload.mock_location_detected}::boolean,
              ${payload.app_version}
            )
          )
          SELECT rpc.*, current_setting('app.attendance_is_new', true) as is_new
          FROM rpc
        `;

        if (!result || result.length === 0) {
          throw new Error('Failed to mark attendance');
        }

        const attendanceRecord = result[0];

        // 3. Derive Service-Level Presentation Fields
        const flagged = attendanceRecord.audit_metadata?.device_collision_detected === true;
        const points_awarded = SCORE_RULES.ATTENDANCE;

        const is_new = attendanceRecord.is_new === 'true';

        return {
          attendance_id: attendanceRecord.id,
          status: attendanceRecord.status,
          points_awarded,
          flagged,
          is_new,
        };
      });
    } catch (error: unknown) {
      if ((error as any).statusCode) throw error;
      mapDatabaseError(error);
    }
  }

  /**
   * Syncs offline attendance records via batch RPC.
   */
  async syncOffline(
    userId: string,
    payload: {
      records: Array<{
        user_id: string;
        session_id: string;
        scanned_token: string;
        scan_timestamp: string;
        device_id: string;
        gps_lat: number;
        gps_lng: number;
        gps_accuracy: number;
        mock_location_detected: boolean;
        offline_seq: number;
      }>;
    }
  ) {
    if (!payload.records || payload.records.length === 0) {
      return { processed: 0, skipped: 0, errors: [] };
    }

    const sessionIds = [...new Set(payload.records.map((r) => r.session_id))];

    const sessions = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.user_id', ${userId}, true)`;
      return tx.attendanceSession.findMany({
        where: { id: { in: sessionIds } },
        select: { id: true, qrSecret: true },
      });
    });
    const sessionSecretMap = new Map(sessions.map((s) => [s.id, s.qrSecret]));

    const validRecords: Array<{
      user_id: string;
      session_id: string;
      scanned_token: string;
      scan_timestamp: string;
      device_id: string;
      gps_lat: number;
      gps_lng: number;
      gps_accuracy: number;
      mock_location_detected: boolean;
      offline_seq: number;
    }> = [];
    const errors: Array<{ user_id: string; error_code: string }> = [];
    let skipped = 0;

    for (const record of payload.records) {
      const secret = sessionSecretMap.get(record.session_id);
      if (!secret) {
        skipped++;
        errors.push({
          user_id: userId,
          error_code: 'SESSION_CLOSED',
        });
        continue;
      }

      const scanTimeMs = new Date(record.scan_timestamp).getTime();
      const isValid = verifyQrPayload(record.session_id, record.scanned_token, secret, scanTimeMs);
      
      if (!isValid) {
        skipped++;
        errors.push({
          user_id: userId,
          error_code: 'INVALID_SIGNATURE',
        });
      } else {
        validRecords.push(record);
      }
    }

    if (validRecords.length === 0) {
      return { processed: 0, skipped, errors };
    }

    const result = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.user_id', ${userId}, true)`;
      const recordsJson = JSON.stringify(validRecords);

      const [{ result }] = await tx.$queryRaw<{ result: any }[]>`
        SELECT sync_offline_attendance_v9(${recordsJson}::jsonb) as result
      `;
      return result;
    });

    const dbResult = result;

    const sanitizedDbErrors = (dbResult.errors || []).map(
      (e: { user_id: string; error_code: string }) => sanitizeOfflineError(e)
    );

    return {
      processed: dbResult.processed,
      skipped: dbResult.skipped + skipped,
      errors: [...errors, ...sanitizedDbErrors],
    };
  }

  async getEventAttendance(userId: string, eventId: string, query: any): Promise<{ data: any[]; nextCursor?: string }> {
    return withUserContext(userId, async (tx) => {
      const { cursor, limit, filter_session_id, filter_status, filter_flagged } = query;
      const where: any = { session: { eventId } };
      if (filter_session_id) where.sessionId = filter_session_id;
      if (filter_status) where.status = filter_status;
      if (filter_flagged !== undefined) {
        if (filter_flagged) {
          where.auditMetadata = { path: ['device_collision_detected'], equals: true };
        } else {
          where.auditMetadata = { not: { path: ['device_collision_detected'], equals: true } };
        }
      }
      const records = await tx.attendanceRecord.findMany({
        where,
        take: limit + 1,
        ...(cursor && { cursor: { id: cursor }, skip: 1 }),
        orderBy: { markedAt: 'desc' },
        include: { user: { select: { id: true, fullName: true, email: true } } },
      });
      let nextCursor = undefined;
      if (records.length > limit) {
        const nextItem = records.pop();
        nextCursor = nextItem!.id;
      }
      return { data: records, nextCursor };
    });
  }

  async getMyAttendance(userId: string, query: any): Promise<{ data: any[]; nextCursor?: string }> {
    return withUserContext(userId, async (tx) => {
      const { cursor, limit } = query;
      const records = await tx.attendanceRecord.findMany({
        where: { userId },
        take: limit + 1,
        ...(cursor && { cursor: { id: cursor }, skip: 1 }),
        orderBy: { markedAt: 'desc' },
        include: { session: { include: { event: { select: { title: true } } } } },
      });
      let nextCursor = undefined;
      if (records.length > limit) {
        const nextItem = records.pop();
        nextCursor = nextItem!.id;
      }
      return { data: records, nextCursor };
    });
  }

  async manualMarkAttendance(userId: string, payload: { session_id: string; user_id: string }) {
    try {
      const result = await withUserContext(userId, async (tx) => {
        const session = await tx.attendanceSession.findUnique({
          where: { id: payload.session_id },
          select: { eventId: true },
        });

        if (!session) throw new UnprocessableEntityError('SESSION_CLOSED');
        
        const event = await tx.event.findUnique({
          where: { id: session.eventId },
          select: { isLocked: true, endTime: true }
        });
        
        if (event) {
          const dbTimeResult = await tx.$queryRaw<{ now: Date }[]>`SELECT now() as now`;
          const dbNow = dbTimeResult[0].now;
          const finalDeadline = new Date(event.endTime.getTime() + 24 * 60 * 60 * 1000);
          
          if (event.isLocked || dbNow >= finalDeadline) {
            throw new Error('EVENT_LOCKED');
          }
        }

        return await tx.$queryRaw<any[]>`
          WITH rpc AS (
            SELECT * FROM manual_mark_attendance(${payload.session_id}::uuid, ${payload.user_id}::uuid)
          )
          SELECT rpc.*, current_setting('app.attendance_is_new', true) as is_new
          FROM rpc
        `;
      });
      if (!result || result.length === 0) throw new Error('Failed to manually mark attendance');
      const attendanceRecord = result[0];
      const is_new = attendanceRecord.is_new === 'true';
      return { attendance_record: attendanceRecord, is_new };
    } catch (error: unknown) {
      if ((error as any).statusCode) throw error;
      mapDatabaseError(error);
    }
  }

  async submitAttendanceDispute(userId: string, payload: { session_id: string; reason: string; evidence_urls?: string[] }) {
    try {
      const result = await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.user_id', ${userId}, true)`;
        return await tx.$queryRaw<any[]>`
          SELECT * FROM submit_attendance_dispute(
            ${payload.session_id}::uuid,
            ${payload.reason},
            ${payload.evidence_urls ? payload.evidence_urls : null}::text[]
          )
        `;
      });
      if (!result || result.length === 0) throw new Error('Failed to submit dispute');
      return result[0];
    } catch (error: unknown) {
      mapDatabaseError(error);
    }
  }

  async getAttendanceDisputes(userId: string, eventId: string | undefined, query: any): Promise<{ data: any[]; nextCursor?: string }> {
    return withUserContext(userId, async (tx) => {
      const { cursor, limit, filter_status, filter_club_id } = query;
      const where: any = { deletedAt: null };
      if (eventId) where.eventId = eventId;
      if (filter_status) where.status = filter_status;
      
      if (filter_club_id) {
        where.event = {
          eventClubs: { some: { clubId: filter_club_id } }
        };

        // Explicitly verify the caller's authority over that club.
        const user = await tx.user.findUnique({ where: { id: userId }, select: { globalRole: true } });
        if (user && !['PLATFORM_ADMIN', 'FACULTY_ADMIN'].includes(user.globalRole)) {
          const membership = await tx.clubMembership.findFirst({
            where: {
              clubId: filter_club_id,
              userId: userId,
              deletedAt: null,
              role: { in: ['CLUB_ADMIN', 'CORE_MEMBER', 'FACULTY_MENTOR'] },
            }
          });
          if (!membership) {
            throw new Error('Unauthorized to view disputes for this club');
          }
        }
      }

      const disputes = await tx.attendanceDispute.findMany({
        where,
        take: limit + 1,
        ...(cursor && { cursor: { id: cursor }, skip: 1 }),
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { id: true, fullName: true } } },
      });
      let nextCursor = undefined;
      if (disputes.length > limit) {
        const nextItem = disputes.pop();
        nextCursor = nextItem!.id;
      }
      return { data: disputes, nextCursor };
    });
  }

  async resolveAttendanceDispute(userId: string, disputeId: string, payload: { resolution: string; review_notes?: string }) {
    try {
      const result = await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.user_id', ${userId}, true)`;
        const rpcResult = await tx.$queryRaw<any[]>`
          SELECT * FROM resolve_attendance_dispute(
            ${disputeId}::uuid,
            ${payload.resolution},
            ${payload.review_notes || null}
          )
        `;

        if (!rpcResult || rpcResult.length === 0) throw new Error('Failed to resolve dispute');

        const dispute = await tx.attendanceDispute.findUnique({
          where: { id: disputeId },
          include: { event: { select: { title: true } } },
        });

        if (dispute) {
          await enqueueNotification({
            tx,
            userId: dispute.userId,
            type: 'ATTENDANCE_DISPUTE_RESOLVED',
            title: `Attendance Dispute ${payload.resolution}`,
            body: `Your dispute for ${dispute.event.title} has been ${payload.resolution}.`,
            metadata: {
              schema_version: 1,
              routing: { target: `/attendance/disputes/${disputeId}`, fallback: '/attendance/disputes', params: { dispute_id: disputeId } },
              entity_ids: { event_id: dispute.eventId, dispute_id: disputeId },
              action_payload: { status: payload.resolution },
            },
            preferenceGate: 'attendance_alerts',
            idempotencyString: `ATTENDANCE_DISPUTE_RESOLVED${dispute.userId}${disputeId}${payload.resolution}`,
          });
        }

        return rpcResult[0];
      });
      return result;
    } catch (error: unknown) {
      mapDatabaseError(error);
    }
  }

  async reviewFlaggedAttendance(userId: string, attendanceId: string) {
    try {
      const result = await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.user_id', ${userId}, true)`;
        const rpcResult = await tx.$queryRaw<any[]>`
          SELECT * FROM review_flagged_attendance(
            ${attendanceId}::uuid
          );
        `;
        return rpcResult[0];
      });
      return result;
    } catch (error: any) {
      if (error.message.includes('UNAUTHORIZED_REVIEWER') || error.message.includes('UNAUTHORIZED') || error.message.includes('permission denied')) {
        throw new ForbiddenError('Forbidden');
      }
      if (error.message.includes('ATTENDANCE_NOT_FOUND')) {
        throw new NotFoundError('Attendance record not found');
      }
      if (error.message.includes('ATTENDANCE_NOT_FLAGGED')) {
        throw new BadRequestError('Attendance is not flagged for collision');
      }
      throw error;
    }
  }

  async exportEventAttendance(userId: string, eventId: string): Promise<string> {
    return withUserContext(userId, async (tx) => {
      const records = await tx.attendanceRecord.findMany({
        where: {
          session: { eventId }
        },
        include: {
          user: { select: { fullName: true, email: true } },
          session: { select: { title: true } }
        },
        orderBy: { markedAt: 'asc' }
      });

      // Prevent CSV Injection (Spreadsheet formula injection)
      const sanitizeCsv = (val: string) => {
        const str = val.replace(/"/g, '""');
        return /^[=+\-@]/.test(str) ? "'" + str : str;
      };

      // Create CSV header
      let csv = 'user_name,user_email,session_title,status,method,marked_at\n';

      // Append rows
      for (const record of records) {
        const name = `"${sanitizeCsv(record.user.fullName)}"`;
        const email = `"${sanitizeCsv(record.user.email)}"`;
        const sessionTitle = `"${sanitizeCsv(record.session.title)}"`;
        const status = record.status;
        const method = record.method;
        const markedAt = record.markedAt.toISOString();

        csv += `${name},${email},${sessionTitle},${status},${method},${markedAt}\n`;
      }

      return csv;
    });
  }
}

export const attendanceService = new AttendanceService();
