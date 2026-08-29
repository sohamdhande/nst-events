import { describe, it, before } from 'node:test';
import * as assert from 'node:assert';
import { prisma } from '../../src/lib/prisma';
import { adminPrisma } from '../helpers/adminDb';
import { generateQrPayload } from '../../src/modules/attendance/totp.utils';
import { AttendanceService } from '../../src/modules/attendance/attendance.service';
import { signJwt } from '../../src/lib/jwt';
import request from 'supertest';
import { createApp } from '../../src/app';

const app = createApp();

describe('ATTENDANCE-06: Offline Identity Binding BOLA Protection', () => {
  let eventId: string;
  let sessionId: string;
  let studentAId: string;
  let studentBId: string;
  let secret: string;

  const attendanceService = new AttendanceService();

  before(async () => {
    // Clear out
    await adminPrisma.teamInvitation.deleteMany({});
    await adminPrisma.team.deleteMany({});
    await adminPrisma.attendanceRecord.deleteMany({});
    await adminPrisma.consumedQrSignature.deleteMany({});
    await adminPrisma.attendanceSession.deleteMany({});
    await adminPrisma.eventRegistration.deleteMany({});
    await adminPrisma.eventAudienceBatch.deleteMany({});
    await adminPrisma.eventClub.deleteMany({});
    await adminPrisma.event.deleteMany({});
    await adminPrisma.leaderboardScore.deleteMany({});
    await adminPrisma.user.deleteMany({
      where: { email: { in: ['studentA_offline@nst.com', 'studentB_offline@nst.com'] } }
    });

    // Create users
    const studentA = await adminPrisma.user.create({ data: { id: crypto.randomUUID(), email: 'studentA_offline@nst.com', fullName: 'Student A', globalRole: 'STUDENT', googleSub: 'subA_off' } });
    const studentB = await adminPrisma.user.create({ data: { id: crypto.randomUUID(), email: 'studentB_offline@nst.com', fullName: 'Student B', globalRole: 'STUDENT', googleSub: 'subB_off' } });

    studentAId = studentA.id;
    studentBId = studentB.id;

    // Create event
    const event = await adminPrisma.event.create({
      data: {
        id: crypto.randomUUID(),
        title: 'Offline Security Event',
        description: 'Test',
        state: 'PUBLISHED',
        visibility: 'PUBLIC',
        registrationType: 'INDIVIDUAL',
        attendanceType: 'SINGLE',
        audience: 'ALL_STUDENTS',
        eventType: 'MEETUP',
        createdBy: studentAId,
        startTime: new Date(Date.now() - 100000),
        endTime: new Date(Date.now() + 200000),
      }
    });
    eventId = event.id;

    // Register both
    await adminPrisma.eventRegistration.createMany({
      data: [
        { eventId, userId: studentAId, registrationStatus: 'REGISTERED' },
        { eventId, userId: studentBId, registrationStatus: 'REGISTERED' }
      ]
    });

    // Create session
    secret = 'secure_secret_123';
    const session = await adminPrisma.attendanceSession.create({
      data: {
        id: crypto.randomUUID(),
        eventId,
        title: 'Main Session',
        qrSecret: secret,
        openAt: new Date(Date.now() - 10000),
        closeAt: new Date(Date.now() + 10000),
        startTime: new Date(Date.now() - 10000),
        endTime: new Date(Date.now() + 10000),
        geofenceRadius: 50,
        venueLatitude: 10,
        venueLongitude: 10,
        createdBy: studentAId
      }
    });
    sessionId = session.id;
  });

  const runSync = async (callerId: string, payloadUserId: string, scanTimeMs: number) => {
    const signature = generateQrPayload(sessionId, secret);
    return attendanceService.syncOffline(callerId, {
      records: [{
        user_id: payloadUserId, // The vulnerable payload field
        session_id: sessionId,
        scanned_token: signature,
        scan_timestamp: new Date(scanTimeMs).toISOString(),
        device_id: 'test_device_' + Date.now(),
        gps_lat: 10,
        gps_lng: 10,
        gps_accuracy: 10,
        mock_location_detected: false,
        offline_seq: 1
      }]
    });
  };

  it('Student A + payload user_id B -> Attendance credited to A (BOLA protection)', async () => {
    await adminPrisma.consumedQrSignature.deleteMany({});
    const scanTimeMs = Date.now();
    const res = await runSync(studentAId, studentBId, scanTimeMs);
    console.log('SYNC RES:', res);

    // Verify A got attendance
    const recordsA = await adminPrisma.attendanceRecord.findMany({ where: { sessionId, userId: studentAId } });
    assert.strictEqual(recordsA.length, 1, 'Student A should receive the attendance record');

    // Verify B did NOT get attendance
    const recordsB = await adminPrisma.attendanceRecord.findMany({ where: { sessionId, userId: studentBId } });
    assert.strictEqual(recordsB.length, 0, 'Student B MUST NOT receive attendance (Vulnerability closed)');
  });

  it('Student A + malformed user_id -> Attendance credited to A', async () => {
    await adminPrisma.consumedQrSignature.deleteMany({});
    const scanTimeMs = Date.now();
    await runSync(studentAId, 'not-a-uuid', scanTimeMs);

    // Should still succeed and not throw UUID cast error because the field is ignored
    const recordsA = await adminPrisma.attendanceRecord.findMany({ where: { sessionId, userId: studentAId } });
    assert.strictEqual(recordsA.length, 1, 'Student A still receives attendance despite malformed payload field');
  });

  it('Student B + normal sync -> Attendance credited to B', async () => {
    await adminPrisma.consumedQrSignature.deleteMany({});
    const scanTimeMs = Date.now();
    await runSync(studentBId, studentBId, scanTimeMs);

    const recordsB = await adminPrisma.attendanceRecord.findMany({ where: { sessionId, userId: studentBId } });
    assert.strictEqual(recordsB.length, 1, 'Student B receives attendance');
  });

  it('STUDENT / CLUB_ADMIN cannot call manual POST /attendance/manual -> 403', async () => {
    const token = signJwt(studentAId, 1);
    const authHeader = `Bearer ${token}`;

    const res = await request(app)
      .post(`/v1/events/${eventId}/attendance/manual`)
      .set('Authorization', authHeader)
      .send({
        student_id: studentBId,
        session_id: sessionId
      });
    
    assert.strictEqual(res.status, 403, 'Must reject manual attendance if not PLATFORM_ADMIN');
  });

});
