import test from 'node:test';
import assert from 'node:assert';
import { prisma } from '../../src/lib/prisma';
import { adminPrisma } from '../helpers/adminDb';
import { attendanceService } from '../../src/modules/attendance/attendance.service';
import { generateQrPayload } from '../../src/modules/attendance/totp.utils';
import { UnprocessableEntityError, ConflictError } from '../../src/lib/errors';
import crypto from 'crypto';

test('Attendance Single-Use QR validation', async (t) => {
  // 1. Setup mock users
  const user1 = await adminPrisma.user.create({
    data: {
      email: `user1-${Date.now()}@test.com`,
      googleSub: `sub-u1-${Date.now()}`,
      fullName: 'User One',
    }
  });

  const user2 = await adminPrisma.user.create({
    data: {
      email: `user2-${Date.now()}@test.com`,
      googleSub: `sub-u2-${Date.now()}`,
      fullName: 'User Two',
    }
  });

  // 2. Setup event and session
  const event = await adminPrisma.event.create({
    data: {
      title: 'Test Event QR',
      startTime: new Date(Date.now() - 3600000),
      endTime: new Date(Date.now() + 3600000),
      eventType: 'WORKSHOP',
      createdBy: user1.id,
      state: 'PUBLISHED',
      isLocked: false,
    }
  });

  const session = await adminPrisma.attendanceSession.create({
    data: {
      eventId: event.id,
      title: 'Test Session',
      startTime: new Date(Date.now() - 3600000),
      endTime: new Date(Date.now() + 3600000),
      openAt: new Date(Date.now() - 3600000),
      closeAt: new Date(Date.now() + 3600000),
      geofenceRadius: 10000,
      qrSecret: crypto.randomBytes(32).toString('hex'),
    }
  });

  // 3. Register both users for the event
  await adminPrisma.eventRegistration.createMany({
    data: [
      { eventId: event.id, userId: user1.id },
      { eventId: event.id, userId: user2.id }
    ]
  });

  // 4. Test relay attack: Two users scanning the SAME QR code concurrently
  const qrPayload = generateQrPayload(session.id, session.qrSecret);

  const payload = {
    session_id: session.id,
    totp_token: qrPayload,
    latitude: 0,
    longitude: 0,
    device_id: 'test-device-1',
    device_os: 'ios',
    gps_accuracy: 10,
    mock_location_detected: false,
    app_version: '1.0.0'
  };

  const payload2 = {
    ...payload,
    device_id: 'test-device-2'
  };

  // Fire both requests concurrently!
  const results = await Promise.allSettled([
    attendanceService.markAttendance(user1.id, payload),
    attendanceService.markAttendance(user2.id, payload2)
  ]);

  const fulfilled = results.filter(r => r.status === 'fulfilled');
  const rejected = results.filter(r => r.status === 'rejected');

  console.log('REJECTED:', rejected.map(r => r.status === 'rejected' ? r.reason : null));

  assert.strictEqual(fulfilled.length, 1, 'Exactly one concurrent request should succeed');
  assert.strictEqual(rejected.length, 1, 'Exactly one concurrent request should fail');

  if (rejected[0].status === 'rejected') {
    assert.ok(rejected[0].reason instanceof ConflictError, 'Rejection should be ConflictError');
    assert.strictEqual(rejected[0].reason.message, 'This QR code has already been used');
  }

  // Cleanup
  await adminPrisma.consumedQrSignature.deleteMany({ where: { sessionId: session.id } });
  await adminPrisma.leaderboardScore.deleteMany({ where: { userId: { in: [user1.id, user2.id] } } });
  await adminPrisma.attendanceRecord.deleteMany({ where: { sessionId: session.id } });
  await adminPrisma.attendanceSession.delete({ where: { id: session.id } });
  await adminPrisma.eventRegistration.deleteMany({ where: { eventId: event.id } });
  await adminPrisma.event.delete({ where: { id: event.id } });
  await adminPrisma.user.deleteMany({ where: { id: { in: [user1.id, user2.id] } } });
});
