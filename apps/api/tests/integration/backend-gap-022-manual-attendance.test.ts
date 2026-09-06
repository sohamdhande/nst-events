import { describe, it, before } from 'node:test';
import * as assert from 'node:assert';
import { adminPrisma } from '../helpers/adminDb';
import { signJwt } from '../../src/lib/jwt';
import request from 'supertest';
import { createApp } from '../../src/app';

const app = createApp();

describe('BACKEND-GAP-022: Manual Attendance Authorization & Multi-Session', () => {
  let eventId: string;
  let session1Id: string;
  let session2Id: string;
  let studentUserId: string;
  let primaryClubAdminId: string;
  let unrelatedClubAdminId: string;
  let platformAdminId: string;

  before(async () => {
    // Clear existing data
    await adminPrisma.leaderboardScore.deleteMany({});
    await adminPrisma.auditLog.deleteMany({});
    await adminPrisma.attendanceRecord.deleteMany({});
    await adminPrisma.attendanceSession.deleteMany({});
    await adminPrisma.eventRegistration.deleteMany({});
    await adminPrisma.eventClub.deleteMany({});
    await adminPrisma.clubMembership.deleteMany({});
    await adminPrisma.event.deleteMany({ where: { title: 'GAP-022 Test Event' } });
    await adminPrisma.club.deleteMany({ where: { name: { in: ['GAP022 Primary Club', 'GAP022 Unrelated Club'] } } });
    await adminPrisma.user.deleteMany({
      where: {
        email: {
          in: [
            'gap022_student@nst.com',
            'gap022_primary_admin@nst.com',
            'gap022_unrelated_admin@nst.com',
            'gap022_platform_admin@nst.com'
          ]
        }
      }
    });

    // 1. Create users
    const studentUser = await adminPrisma.user.create({
      data: { id: crypto.randomUUID(), email: 'gap022_student@nst.com', fullName: 'Student GAP022', globalRole: 'STUDENT', googleSub: 'sub_gap_s' }
    });
    const primaryClubAdmin = await adminPrisma.user.create({
      data: { id: crypto.randomUUID(), email: 'gap022_primary_admin@nst.com', fullName: 'Primary Club Admin', globalRole: 'STUDENT', googleSub: 'sub_gap_pca' }
    });
    const unrelatedClubAdmin = await adminPrisma.user.create({
      data: { id: crypto.randomUUID(), email: 'gap022_unrelated_admin@nst.com', fullName: 'Unrelated Club Admin', globalRole: 'STUDENT', googleSub: 'sub_gap_uca' }
    });
    const platformAdmin = await adminPrisma.user.create({
      data: { id: crypto.randomUUID(), email: 'gap022_platform_admin@nst.com', fullName: 'Platform Admin GAP022', globalRole: 'PLATFORM_ADMIN', googleSub: 'sub_gap_pa' }
    });

    studentUserId = studentUser.id;
    primaryClubAdminId = primaryClubAdmin.id;
    unrelatedClubAdminId = unrelatedClubAdmin.id;
    platformAdminId = platformAdmin.id;

    // 2. Create clubs
    const primaryClub = await adminPrisma.club.create({
      data: { id: crypto.randomUUID(), name: 'GAP022 Primary Club' }
    });
    const unrelatedClub = await adminPrisma.club.create({
      data: { id: crypto.randomUUID(), name: 'GAP022 Unrelated Club' }
    });

    // 3. Create memberships
    await adminPrisma.clubMembership.createMany({
      data: [
        { clubId: primaryClub.id, userId: primaryClubAdminId, role: 'CLUB_ADMIN' },
        { clubId: unrelatedClub.id, userId: unrelatedClubAdminId, role: 'CLUB_ADMIN' }
      ]
    });

    // 4. Create multi-session event
    const event = await adminPrisma.event.create({
      data: {
        id: crypto.randomUUID(),
        title: 'GAP-022 Test Event',
        description: 'Testing manual attendance authorization',
        state: 'PUBLISHED',
        visibility: 'PUBLIC',
        registrationType: 'INDIVIDUAL',
        attendanceType: 'MULTI_SESSION',
        audience: 'ALL_STUDENTS',
        eventType: 'WORKSHOP',
        createdBy: platformAdminId,
        startTime: new Date(Date.now() - 100000),
        endTime: new Date(Date.now() + 200000),
        eventClubs: {
          create: { clubId: primaryClub.id, isPrimary: true }
        }
      }
    });
    eventId = event.id;

    // 5. Register student
    await adminPrisma.eventRegistration.create({
      data: { eventId, userId: studentUserId, registrationStatus: 'REGISTERED' }
    });

    // 6. Create two sessions
    const session1 = await adminPrisma.attendanceSession.create({
      data: {
        id: crypto.randomUUID(),
        eventId,
        title: 'Session 1',
        qrSecret: 'secret1',
        openAt: new Date(Date.now() - 10000),
        closeAt: new Date(Date.now() + 10000),
        startTime: new Date(Date.now() - 10000),
        endTime: new Date(Date.now() + 10000),
        geofenceRadius: 50,
        venueLatitude: 10,
        venueLongitude: 10,
        createdBy: primaryClubAdminId
      }
    });
    const session2 = await adminPrisma.attendanceSession.create({
      data: {
        id: crypto.randomUUID(),
        eventId,
        title: 'Session 2',
        qrSecret: 'secret2',
        openAt: new Date(Date.now() - 10000),
        closeAt: new Date(Date.now() + 10000),
        startTime: new Date(Date.now() - 10000),
        endTime: new Date(Date.now() + 10000),
        geofenceRadius: 50,
        venueLatitude: 10,
        venueLongitude: 10,
        createdBy: primaryClubAdminId
      }
    });

    session1Id = session1.id;
    session2Id = session2.id;
  });

  it('1. Normal STUDENT is denied manual attendance (403)', async () => {
    const token = signJwt(studentUserId, 1);
    const res = await request(app)
      .post(`/v1/events/${eventId}/attendance/manual`)
      .set('Authorization', `Bearer ${token}`)
      .send({ session_id: session1Id, user_id: studentUserId });

    assert.strictEqual(res.status, 403);
  });

  it('2. Unrelated CLUB_ADMIN is denied manual attendance (403)', async () => {
    const token = signJwt(unrelatedClubAdminId, 1);
    const res = await request(app)
      .post(`/v1/events/${eventId}/attendance/manual`)
      .set('Authorization', `Bearer ${token}`)
      .send({ session_id: session1Id, user_id: studentUserId });

    assert.strictEqual(res.status, 403);
  });

  it('3. Authorized primary CLUB_ADMIN CAN manually mark attendance for Session 1 (201)', async () => {
    const token = signJwt(primaryClubAdminId, 1);
    const res = await request(app)
      .post(`/v1/events/${eventId}/attendance/manual`)
      .set('Authorization', `Bearer ${token}`)
      .send({ session_id: session1Id, user_id: studentUserId });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.session_id, session1Id);
    assert.strictEqual(res.body.user_id, studentUserId);
    assert.strictEqual(res.body.method, 'MANUAL');

    // Verify record exists in DB for Session 1, NOT Session 2
    const rec1 = await adminPrisma.attendanceRecord.findUnique({
      where: { sessionId_userId: { sessionId: session1Id, userId: studentUserId } }
    });
    assert.ok(rec1);

    const rec2 = await adminPrisma.attendanceRecord.findUnique({
      where: { sessionId_userId: { sessionId: session2Id, userId: studentUserId } }
    });
    assert.strictEqual(rec2, null, 'Session 2 MUST NOT be updated when Session 1 was targeted');
  });

  it('4. PLATFORM_ADMIN CAN manually mark attendance for Session 2 (201)', async () => {
    const token = signJwt(platformAdminId, 1);
    const res = await request(app)
      .post(`/v1/events/${eventId}/attendance/manual`)
      .set('Authorization', `Bearer ${token}`)
      .send({ session_id: session2Id, user_id: studentUserId });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.session_id, session2Id);

    const rec2 = await adminPrisma.attendanceRecord.findUnique({
      where: { sessionId_userId: { sessionId: session2Id, userId: studentUserId } }
    });
    assert.ok(rec2, 'Session 2 record created by PLATFORM_ADMIN');
  });
});
