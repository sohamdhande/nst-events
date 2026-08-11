import { prisma, withUserContext } from '@nst/database';
import { generateQrPayload, verifyQrPayload } from './totp.utils';
import { UnprocessableEntityError, ConflictError } from '../../lib/errors';
import { SCORE_RULES } from '../../config/score-rules';
import { enqueueNotification } from '../notifications/notifications.producer';

export class AttendanceService {
  /**
   * Generates a new TOTP QR payload.
   */
  async generateQr(sessionId: string) {
    const session = await prisma.attendanceSession.findUnique({
      where: { id: sessionId },
      select: { qrSecret: true },
    });
    
    if (!session) {
      throw new Error('Session not found');
    }

    const qr_payload = generateQrPayload(sessionId, session.qrSecret);
    // Expires at the end of the current 15-second window.
    const expires_at = new Date(Math.ceil(Date.now() / 15000) * 15000).toISOString();
    return { qr_payload, expires_at };
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
        const session = await tx.attendanceSession.findUnique({
          where: { id: payload.session_id },
          select: { qrSecret: true },
        });

        if (!session) {
          throw new UnprocessableEntityError('SESSION_CLOSED');
        }

        const isValid = verifyQrPayload(payload.session_id, payload.totp_token, session.qrSecret);
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
            SELECT * FROM mark_attendance(
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
    } catch (error: any) {
      // Map PostgreSQL RAISE EXCEPTION errors to HTTP 422
      const msg = error.message || '';
      if (msg.includes('MOCK_LOCATION_REJECTED')) throw new UnprocessableEntityError('MOCK_LOCATION_REJECTED');
      if (msg.includes('SESSION_CLOSED')) throw new UnprocessableEntityError('SESSION_CLOSED');
      if (msg.includes('EVENT_LOCKED')) throw new UnprocessableEntityError('EVENT_LOCKED');
      if (msg.includes('OUTSIDE_GEOFENCE')) throw new UnprocessableEntityError('OUTSIDE_GEOFENCE');
      if (msg.includes('NOT_REGISTERED')) throw new UnprocessableEntityError('NOT_REGISTERED');
      if (msg.includes('UNAUTHORIZED')) throw new UnprocessableEntityError('UNAUTHORIZED');
      
      throw error;
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
        offline_seq: number;
      }>;
    }
  ) {
    const result = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.user_id', ${userId}, true)`;
      const recordsJson = JSON.stringify(payload.records);
      
      return await tx.$queryRaw<any[]>`
        SELECT sync_offline_attendance(${recordsJson}::jsonb) as result
      `;
    });

    return result[0].result;
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
      const result = await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.user_id', ${userId}, true)`;
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
    } catch (error: any) {
      const msg = error.message || '';
      if (msg.includes('UNAUTHORIZED')) throw new UnprocessableEntityError('UNAUTHORIZED');
      if (msg.includes('SESSION_CLOSED')) throw new UnprocessableEntityError('SESSION_CLOSED');
      if (msg.includes('EVENT_LOCKED')) throw new UnprocessableEntityError('EVENT_LOCKED');
      if (msg.includes('NOT_REGISTERED')) throw new UnprocessableEntityError('NOT_REGISTERED');
      throw error;
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
    } catch (error: any) {
      const msg = error.message || '';
      if (msg.includes('DISPUTE_WINDOW_EXPIRED')) throw new UnprocessableEntityError('DISPUTE_WINDOW_EXPIRED');
      if (msg.includes('SESSION_CLOSED')) throw new UnprocessableEntityError('SESSION_CLOSED');
      throw error;
    }
  }

  async getAttendanceDisputes(userId: string, eventId: string | undefined, query: any): Promise<{ data: any[]; nextCursor?: string }> {
    return withUserContext(userId, async (tx) => {
      const { cursor, limit, filter_status } = query;
      const where: any = {};
      if (eventId) where.eventId = eventId;
      if (filter_status) where.status = filter_status;
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
    } catch (error: any) {
      const msg = error.message || '';
      if (msg.includes('DISPUTE_NOT_FOUND')) throw new UnprocessableEntityError('DISPUTE_NOT_FOUND');
      if (msg.includes('DISPUTE_ALREADY_RESOLVED')) throw new UnprocessableEntityError('DISPUTE_ALREADY_RESOLVED');
      if (msg.includes('INVALID_RESOLUTION')) throw new UnprocessableEntityError('INVALID_RESOLUTION');
      throw error;
    }
  }
}

export const attendanceService = new AttendanceService();
