import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import { adminPrisma } from '../helpers/adminDb';
import { generateQrPayload } from '../../src/modules/attendance/totp.utils';
import { createApp } from '../../src/app';
import { signJwt } from '../../src/lib/jwt';
import { randomUUID } from 'crypto';

const app = createApp();

describe('Phase 18: Private Event QR Attendance Regression', () => {
  let adminId = randomUUID();
  let studentId = randomUUID();
  let eventId = randomUUID();
  let sessionId = randomUUID();
  let token: string;
  let qrPayload: string;

  before(async () => {
    // 1. Setup users (Admin is club member, Student is NOT)
    await adminPrisma.user.createMany({
      data: [
        { id: adminId, email: `admin-priv-${adminId}@test.com`, googleSub: `admin_priv_${adminId}`, fullName: 'Admin', globalRole: 'STUDENT' },
        { id: studentId, email: `student-priv-${studentId}@test.com`, googleSub: `student_priv_${studentId}`, fullName: 'Student', globalRole: 'STUDENT' }
      ]
    });

    // 2. Setup PRIVATE event
    await adminPrisma.event.create({
      data: {
        id: eventId,
        title: 'Private QR Event',
        description: 'Testing private QR checkin',
        startTime: new Date(Date.now() - 3600000),
        endTime: new Date(Date.now() + 3600000),
        createdBy: adminId,
        maxCapacity: 100,
        eventType: 'WORKSHOP',
        state: 'PUBLISHED',
        visibility: 'PRIVATE' // <-- Crucial: Must be PRIVATE
      }
    });

    // 3. Setup Open Session
    await adminPrisma.attendanceSession.create({
      data: {
        id: sessionId,
        eventId: eventId,
        title: 'Private QR Session',
        startTime: new Date(Date.now() - 3600000),
        endTime: new Date(Date.now() + 3600000),
        openAt: new Date(Date.now() - 3600000),
        closeAt: new Date(Date.now() + 3600000),
        qrSecret: 'regression_secret_key_123',
        createdBy: adminId
      }
    });

    // 4. Register the student for the event (without this, markAttendance RPC fails with NOT_REGISTERED)
    await adminPrisma.eventRegistration.create({
      data: {
        eventId: eventId,
        userId: studentId,
        registrationStatus: 'REGISTERED'
      }
    });

    token = signJwt(studentId);
    qrPayload = generateQrPayload(sessionId, 'regression_secret_key_123');
  });

  after(async () => {
    // Cleanup
    await adminPrisma.leaderboardScore.deleteMany({ where: { userId: studentId } });
    await adminPrisma.attendanceRecord.deleteMany({ where: { userId: studentId } });
    await adminPrisma.consumedQrSignature.deleteMany({ where: { sessionId: sessionId } });
    await adminPrisma.eventRegistration.deleteMany({ where: { eventId: eventId } });
    await adminPrisma.attendanceSession.delete({ where: { id: sessionId } });
    await adminPrisma.event.delete({ where: { id: eventId } });
    await adminPrisma.user.deleteMany({ where: { id: { in: [adminId, studentId] } } });
  });

  it('STUDENT with no club membership successfully marks attendance for a PRIVATE event using a valid QR code', async () => {
    const payload = {
      session_id: sessionId,
      totp_token: qrPayload,
      latitude: 37.7749,
      longitude: -122.4194,
      device_id: 'regression_device',
      device_os: 'iOS',
      gps_accuracy: 10,
      mock_location_detected: false,
      app_version: '1.0.0'
    };

    const res = await request(app)
      .post(`/v1/attendance/mark`)
      .set('Authorization', `Bearer ${token}`)
      .send(payload);

    // Should succeed with 201 Created
    assert.strictEqual(res.status, 201, `Expected 201 Created, got ${res.status}: ${JSON.stringify(res.body)}`);
    assert.strictEqual(res.body.status, 'PRESENT');
  });
});
