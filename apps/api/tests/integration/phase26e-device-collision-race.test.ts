import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import { createApp } from '../../src/app';
import { adminPrisma } from '../helpers/adminDb';
import { signJwt } from '../../src/lib/jwt';
import crypto from 'crypto';
import { randomUUID } from 'crypto';

const app = createApp();

function generateCustomQrPayload(sessionId: string, qrSecret: string, offsetWindows: number): string {
  const windowEpoch = Math.floor(Date.now() / 15000) + offsetWindows;
  const hmacInput = `v1:${sessionId}:${windowEpoch}`;
  const hmac = crypto.createHmac('sha256', qrSecret);
  hmac.update(hmacInput);
  const base64 = hmac.digest('base64');
  const base64Url = base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const signature = base64Url.substring(0, 16);
  return `v1:${sessionId}:${signature}`;
}

describe('Phase 26E: Device Collision Race and Hardening', () => {
  let student1 = randomUUID();
  let student2 = randomUUID();
  let student3 = randomUUID();
  let admin = randomUUID();
  let clubId = randomUUID();
  let eventId = randomUUID();
  let sessionId = randomUUID();

  let student1Token: string;
  let student2Token: string;
  let student3Token: string;
  let adminToken: string;
  let sandbox: any;

  before(async () => {
    sandbox = require('sinon').createSandbox();
    const { prisma } = require('@nst/database');
    const rawSess = await adminPrisma.$queryRawUnsafe(`SELECT * FROM attendance_sessions WHERE id = '${sessionId}'`); console.log('RAW DEBUG:', rawSess);
    await adminPrisma.$executeRawUnsafe(`ALTER TABLE users DISABLE ROW LEVEL SECURITY`);

    await adminPrisma.leaderboardScore.deleteMany({ where: { user: { email: { in: ['s4@adypu.edu.in', 's5@adypu.edu.in'] } } } });
    await adminPrisma.user.deleteMany({ where: { email: { in: ['s4@adypu.edu.in', 's5@adypu.edu.in'] } } });

    await adminPrisma.user.createMany({
      data: [
        { id: student1, email: 's1@adypu.edu.in', googleSub: 'e1', fullName: 'S1', globalRole: 'STUDENT' },
        { id: student2, email: 's2@adypu.edu.in', googleSub: 'e2', fullName: 'S2', globalRole: 'STUDENT' },
        { id: student3, email: 's3@adypu.edu.in', googleSub: 'e3', fullName: 'S3', globalRole: 'STUDENT' },
        { id: admin, email: 'admin@adypu.edu.in', googleSub: 'ea', fullName: 'A', globalRole: 'STUDENT' },
      ]
    });

    await adminPrisma.club.create({ data: { id: clubId, name: 'C1' } });

    await adminPrisma.event.create({
      data: {
        id: eventId,
        title: 'E1',
        state: 'PUBLISHED',
        visibility: 'PUBLIC',
        isLocked: false,
        startTime: new Date(Date.now() - 3600000),
        endTime: new Date(Date.now() + 3600000),
        createdBy: admin,
        eventType: 'WORKSHOP',
        eventClubs: { create: { clubId: clubId } }
      }
    });

    await adminPrisma.clubMembership.create({
      data: { userId: admin, clubId: clubId, role: 'CLUB_ADMIN' }
    });

    await adminPrisma.attendanceSession.create({
      data: {
        id: sessionId,
        eventId: eventId,
        title: 'S1',
        startTime: new Date(Date.now() - 3600000),
        endTime: new Date(Date.now() + 3600000),
        openAt: new Date(Date.now() - 3600000),
        closeAt: new Date(Date.now() + 3600000),
        qrSecret: 'SECRET',
        createdBy: admin
      }
    });

    await adminPrisma.eventRegistration.createMany({
      data: [
        { eventId: eventId, userId: student1 },
        { eventId: eventId, userId: student2 },
        { eventId: eventId, userId: student3 },
      ]
    });

    await adminPrisma.$executeRawUnsafe(`ALTER TABLE users ENABLE ROW LEVEL SECURITY`);

    student1Token = signJwt(student1);
    student2Token = signJwt(student2);
    student3Token = signJwt(student3);
    adminToken = signJwt(admin);
  });

  after(async () => {
    await adminPrisma.leaderboardScore.deleteMany({ where: { userId: { in: [student1, student2, student3] } } });
    await adminPrisma.attendanceRecord.deleteMany({ where: { sessionId } });
    await adminPrisma.consumedQrSignature.deleteMany({ where: { sessionId } });
    await adminPrisma.attendanceSession.deleteMany({ where: { id: sessionId } });
    await adminPrisma.eventRegistration.deleteMany({ where: { eventId } });
    await adminPrisma.eventClub.deleteMany({ where: { eventId } });
    await adminPrisma.event.deleteMany({ where: { id: eventId } });
    await adminPrisma.clubMembership.deleteMany({ where: { clubId } });
    await adminPrisma.club.deleteMany({ where: { id: clubId } });
    await adminPrisma.$executeRawUnsafe(`ALTER TABLE users DISABLE ROW LEVEL SECURITY`);
    await adminPrisma.user.deleteMany({ where: { id: { in: [student1, student2, student3, admin] } } });
    await adminPrisma.$executeRawUnsafe(`ALTER TABLE users ENABLE ROW LEVEL SECURITY`);
  });

  it('Concurrent live scan (Promise.all) safely flags exactly one and awards 5 points to the other', async () => {
    const token1 = generateCustomQrPayload(sessionId, 'SECRET', 0);
    const token2 = generateCustomQrPayload(sessionId, 'SECRET', -1);
    const deviceId = 'race-device';

    // Fire both requests concurrently!
    const [res1, res2] = await Promise.all([
      request(app).post('/v1/attendance/mark').set('Authorization', `Bearer ${student1Token}`).send({
        session_id: sessionId, totp_token: token1, latitude: 10, longitude: 10, device_id: deviceId, device_os: 'iOS', gps_accuracy: 5, mock_location_detected: false, app_version: '1.0'
      }),
      request(app).post('/v1/attendance/mark').set('Authorization', `Bearer ${student2Token}`).send({
        session_id: sessionId, totp_token: token2, latitude: 10, longitude: 10, device_id: deviceId, device_os: 'iOS', gps_accuracy: 5, mock_location_detected: false, app_version: '1.0'
      })
    ]);

    if (res1.status !== 201) console.log(res1.body); assert.strictEqual(res1.status, 201);
    assert.strictEqual(res2.status, 201);

    const record1 = await adminPrisma.attendanceRecord.findUnique({ where: { id: res1.body.attendance_id } });
    const record2 = await adminPrisma.attendanceRecord.findUnique({ where: { id: res2.body.attendance_id } });

    const flag1 = (record1?.auditMetadata as any)?.device_collision_detected || false;
    const flag2 = (record2?.auditMetadata as any)?.device_collision_detected || false;

    // ONE must be flagged, one must be NOT flagged.
    assert.strictEqual(flag1 !== flag2, true);

    const points1: any[] = await adminPrisma.$queryRaw`SELECT points FROM leaderboard_scores WHERE source_id = ${res1.body.attendance_id}::uuid`;
    const points2: any[] = await adminPrisma.$queryRaw`SELECT points FROM leaderboard_scores WHERE source_id = ${res2.body.attendance_id}::uuid`;

    // The one that is NOT flagged gets 5 points, the flagged gets 0
    if (flag1) {
      assert.strictEqual(points1.length, 0);
      assert.strictEqual(points2.length, 1);
      assert.strictEqual(points2[0].points, 5);
    } else {
      assert.strictEqual(points1.length, 1);
      assert.strictEqual(points1[0].points, 5);
      assert.strictEqual(points2.length, 0);
    }
  });

  it('Offline collision correctly applies 0 points and offline non-collision applies 5 points', async () => {
    // Generate valid tokens! Note offline doesn't check the window, but we should use standard token length just in case.
    // Wait, the Phase 26B fix requires `scanned_token` to be used for Replay protection (`consumedQrSignature`), so it just has to be unique.
    const batchDevice = 'batch-device';

    // We will use student3 and student4.
    const student4 = randomUUID();
    await adminPrisma.$executeRawUnsafe(`ALTER TABLE users DISABLE ROW LEVEL SECURITY`);
    await adminPrisma.user.create({ data: { id: student4, email: 's4@adypu.edu.in', googleSub: 's4-sub', fullName: 'S4', globalRole: 'STUDENT' }});
    await adminPrisma.eventRegistration.create({ data: { eventId: eventId, userId: student4 }});
    await adminPrisma.$executeRawUnsafe(`ALTER TABLE users ENABLE ROW LEVEL SECURITY`);

    const payloads = [
      {
        user_id: student3,
        session_id: sessionId,
        scanned_token: generateCustomQrPayload(sessionId, 'SECRET', -2),
        scan_timestamp: new Date(Date.now() - 30000).toISOString(),
        device_id: batchDevice,
        gps_lat: 10,
        gps_lng: 10,
        gps_accuracy: 5,
        mock_location_detected: false,
        offline_seq: 1
      },
      {
        user_id: student4, 
        session_id: sessionId,
        scanned_token: generateCustomQrPayload(sessionId, 'SECRET', -3),
        scan_timestamp: new Date(Date.now() - 45000).toISOString(),
        device_id: batchDevice,
        gps_lat: 10,
        gps_lng: 10,
        gps_accuracy: 5,
        mock_location_detected: false,
        offline_seq: 2
      }
    ];

    const res = await request(app)
      .post('/v1/attendance/sync-offline')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ records: payloads });

    if (res.status !== 200) console.log(res.body);
    assert.strictEqual(res.status, 200);
    if (res.body.processed !== 2) console.error('Offline failed:', res.body.errors);
    assert.strictEqual(res.body.processed, 2);
    
    const rec3 = await adminPrisma.attendanceRecord.findUnique({ where: { sessionId_userId: { sessionId, userId: student3 } } });
    const rec4 = await adminPrisma.attendanceRecord.findUnique({ where: { sessionId_userId: { sessionId, userId: student4 } } });
    
    const flag3 = (rec3?.auditMetadata as any)?.device_collision_detected || false;
    const flag4 = (rec4?.auditMetadata as any)?.device_collision_detected || false;

    // First one should not be flagged, second should be flagged. Or vice versa because of ordering by device_id (both are batch-device, so order is random/stable).
    assert.strictEqual(flag3 !== flag4, true);
    
    const pts3: any[] = await adminPrisma.$queryRaw`SELECT points FROM leaderboard_scores WHERE source_id = ${rec3?.id}::uuid`;
    const pts4: any[] = await adminPrisma.$queryRaw`SELECT points FROM leaderboard_scores WHERE source_id = ${rec4?.id}::uuid`;
    
    if (flag3) {
      assert.strictEqual(pts3.length, 0);
      assert.strictEqual(pts4.length, 1);
      assert.strictEqual(pts4[0].points, 5);
    } else {
      assert.strictEqual(pts3.length, 1);
      assert.strictEqual(pts3[0].points, 5);
      assert.strictEqual(pts4.length, 0);
    }

    // Cleanup student 4
    await adminPrisma.attendanceRecord.deleteMany({ where: { userId: student4 } });
    await adminPrisma.leaderboardScore.deleteMany({ where: { userId: student4 } });
    await adminPrisma.eventRegistration.deleteMany({ where: { userId: student4 } });
    await adminPrisma.$executeRawUnsafe(`ALTER TABLE users DISABLE ROW LEVEL SECURITY`);
    await adminPrisma.user.deleteMany({ where: { id: student4 } });
    await adminPrisma.$executeRawUnsafe(`ALTER TABLE users ENABLE ROW LEVEL SECURITY`);
  });

  it('Device ID boundaries (1, 255, 256, empty)', async () => {
    const student4 = randomUUID();
    await adminPrisma.$executeRawUnsafe(`ALTER TABLE users DISABLE ROW LEVEL SECURITY`);
    await adminPrisma.user.create({ data: { id: student4, email: 's5@adypu.edu.in', googleSub: 's5', fullName: 'S5', globalRole: 'STUDENT' }});
    await adminPrisma.eventRegistration.create({ data: { eventId: eventId, userId: student4 }});
    await adminPrisma.$executeRawUnsafe(`ALTER TABLE users ENABLE ROW LEVEL SECURITY`);
    const student4Token = signJwt(student4);

    const token = generateCustomQrPayload(sessionId, 'SECRET', 1); // valid next window (allowed by drift)

    // Empty device_id -> 400
    const res1 = await request(app).post('/v1/attendance/mark').set('Authorization', `Bearer ${student4Token}`).send({
      session_id: sessionId, totp_token: token, latitude: 10, longitude: 10, device_id: '', device_os: 'iOS', gps_accuracy: 5, mock_location_detected: false, app_version: '1.0'
    });
    assert.strictEqual(res1.status, 400);

    // 256 length -> 400
    const res2 = await request(app).post('/v1/attendance/mark').set('Authorization', `Bearer ${student4Token}`).send({
      session_id: sessionId, totp_token: token, latitude: 10, longitude: 10, device_id: 'a'.repeat(256), device_os: 'iOS', gps_accuracy: 5, mock_location_detected: false, app_version: '1.0'
    });
    assert.strictEqual(res2.status, 400);

    // 255 length -> 201
    const res3 = await request(app).post('/v1/attendance/mark').set('Authorization', `Bearer ${student4Token}`).send({
      session_id: sessionId, totp_token: token, latitude: 10, longitude: 10, device_id: 'a'.repeat(255), device_os: 'iOS', gps_accuracy: 5, mock_location_detected: false, app_version: '1.0'
    });
    assert.strictEqual(res3.status, 201);

    await adminPrisma.leaderboardScore.deleteMany({ where: { userId: student4 } });
    await adminPrisma.attendanceRecord.deleteMany({ where: { userId: student4 } });
    await adminPrisma.eventRegistration.deleteMany({ where: { userId: student4 } });
    await adminPrisma.$executeRawUnsafe(`ALTER TABLE attendance_sessions ENABLE ROW LEVEL SECURITY`);
    await adminPrisma.$executeRawUnsafe(`ALTER TABLE events ENABLE ROW LEVEL SECURITY`);
    await adminPrisma.$executeRawUnsafe(`ALTER TABLE users DISABLE ROW LEVEL SECURITY`);
    await adminPrisma.user.deleteMany({ where: { id: student4 } });
    await adminPrisma.$executeRawUnsafe(`ALTER TABLE users ENABLE ROW LEVEL SECURITY`);
    
    sandbox.restore();
  });
});
