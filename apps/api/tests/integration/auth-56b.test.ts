import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import { createApp } from '../../src/app';
import { prisma } from '../../src/lib/prisma';
import { adminPrisma } from '../helpers/adminDb';
import { signJwt } from '../../src/lib/jwt';

describe('Auth Phase 56B - Role Drifts and securityVersion Realignment', () => {
  let platformAdminToken: string;
  let facultyAdminToken: string;
  let primaryClubAdminToken: string;
  let collaboratingClubAdminToken: string;
  let unauthorizedUserToken: string;

  let platformAdminId: string;
  let facultyAdminId: string;
  let primaryClubAdminId: string;
  let collaboratingClubAdminId: string;
  let unauthorizedUserId: string;

  let testClubId: string;
  let collabClubId: string;
  let testEventId: string;
  let testBatchId: string;
  let testProgramId: string;
  let app: any;

  before(async () => {
    app = createApp();
    // Global wipes are unsafe in a shared DB. The after() block will clean up test-specific data.
    
    // 1. Create Users
    const createRes = await adminPrisma.user.createManyAndReturn({
      data: [
        { email: 'plat2@admin.com', fullName: 'Plat Admin', globalRole: 'PLATFORM_ADMIN', googleSub: 'google-plat2' },
        { email: 'fac2@admin.com', fullName: 'Fac Admin', globalRole: 'FACULTY_ADMIN', googleSub: 'google-fac2' },
        { email: 'prim2@club.com', fullName: 'Prim Club', globalRole: 'STUDENT', googleSub: 'google-prim2' },
        { email: 'collab2@club.com', fullName: 'Collab Club', globalRole: 'STUDENT', googleSub: 'google-collab2' },
        { email: 'unauth2@student.com', fullName: 'Unauth Student', globalRole: 'STUDENT', googleSub: 'google-unauth2' },
      ],
    });

    platformAdminId = createRes[0].id;
    facultyAdminId = createRes[1].id;
    primaryClubAdminId = createRes[2].id;
    collaboratingClubAdminId = createRes[3].id;
    unauthorizedUserId = createRes[4].id;

    platformAdminToken = signJwt(platformAdminId);
    facultyAdminToken = signJwt(facultyAdminId);
    primaryClubAdminToken = signJwt(primaryClubAdminId);
    collaboratingClubAdminToken = signJwt(collaboratingClubAdminId);
    unauthorizedUserToken = signJwt(unauthorizedUserId);

    // 2. Create Program and Batch
    const program = await adminPrisma.academicProgram.create({
      data: { name: 'Test Program 56B', code: 'TP56B' },
    });
    testProgramId = program.id;

    const batch = await adminPrisma.academicBatch.create({
      data: {
        programId: testProgramId,
        admissionYear: 2024,
        graduationYear: 2028,
      },
    });
    testBatchId = batch.id;

    // 3. Create Clubs
    const club1 = await adminPrisma.club.create({
      data: { name: 'Primary Club 56B', description: 'Test' },
    });
    testClubId = club1.id;

    const club2 = await adminPrisma.club.create({
      data: { name: 'Collab Club 56B', description: 'Test' },
    });
    collabClubId = club2.id;

    // 4. Assign Club Memberships
    await adminPrisma.clubMembership.create({
      data: { clubId: testClubId, userId: primaryClubAdminId, role: 'CLUB_ADMIN' },
    });
    await adminPrisma.clubMembership.create({
      data: { clubId: collabClubId, userId: collaboratingClubAdminId, role: 'CLUB_ADMIN' },
    });

    // 5. Create Event with Primary and Collaborating Club
    const event = await adminPrisma.event.create({
      data: {
        title: 'Test Event 56B',
        description: 'Test',
        state: 'DRAFT',
        visibility: 'PUBLIC',
        audience: 'ALL_STUDENTS',
        startTime: new Date(),
        endTime: new Date(Date.now() + 3600000),
        registrationType: 'INDIVIDUAL',
        eventType: 'MEETUP',
        createdBy: platformAdminId,
      },
    });
    testEventId = event.id;

    await adminPrisma.eventClub.create({
      data: { eventId: testEventId, clubId: testClubId, isPrimary: true },
    });
    await adminPrisma.eventClub.create({
      data: { eventId: testEventId, clubId: collabClubId, isPrimary: false },
    });
  });

  after(async () => {
    // Cleanup specific test data
    if (testEventId) {
      await adminPrisma.eventClub.deleteMany({ where: { eventId: testEventId } });
      await adminPrisma.event.delete({ where: { id: testEventId } });
    }
    if (testClubId) {
      await adminPrisma.clubMembership.deleteMany({ where: { clubId: testClubId } });
      await adminPrisma.club.delete({ where: { id: testClubId } });
    }
    if (collabClubId) {
      await adminPrisma.clubMembership.deleteMany({ where: { clubId: collabClubId } });
      await adminPrisma.club.delete({ where: { id: collabClubId } });
    }
    if (testBatchId) await adminPrisma.academicBatch.delete({ where: { id: testBatchId } });
    if (testProgramId) await adminPrisma.academicProgram.delete({ where: { id: testProgramId } });
    
    const userIds = [platformAdminId, facultyAdminId, primaryClubAdminId, collaboratingClubAdminId, unauthorizedUserId].filter(Boolean);
    if (userIds.length > 0) {
      await adminPrisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
  });

  describe('Events: isPrimary validation', () => {
    it('allows Primary Club Admin to update event', async () => {
      const res = await request(app)
        .patch(`/v1/events/${testEventId}`)
        .set('Authorization', `Bearer ${primaryClubAdminToken}`)
        .send({ title: 'Updated Title' });
      assert.strictEqual(res.status, 200);
    });

    it('denies Collaborating Club Admin from updating event', async () => {
      const res = await request(app)
        .patch(`/v1/events/${testEventId}`)
        .set('Authorization', `Bearer ${collaboratingClubAdminToken}`)
        .send({ title: 'Hacked Title' });
      assert.strictEqual(res.status, 403);
    });
  });

  describe('Directory Access', () => {
    it('allows PLATFORM_ADMIN to view users directory', async () => {
      const res = await request(app)
        .get('/v1/admin/users')
        .set('Authorization', `Bearer ${platformAdminToken}`);
      assert.strictEqual(res.status, 200);
    });

    it('allows FACULTY_ADMIN to view users directory', async () => {
      const res = await request(app)
        .get('/v1/admin/users')
        .set('Authorization', `Bearer ${facultyAdminToken}`);
      assert.strictEqual(res.status, 200);
    });

    it('denies PLATFORM_ADMIN mutating students directory from unauthorized', async () => {
      const res = await request(app)
        .post('/v1/admin/students')
        .set('Authorization', `Bearer ${facultyAdminToken}`)
        .send({ email: 'new@student.com' });
      assert.strictEqual(res.status, 403);
    });
  });

  describe('securityVersion Increment on Role Change', () => {
    it('increments securityVersion when a user is added to a club', async () => {
      const preUser = await adminPrisma.user.findUnique({ where: { id: unauthorizedUserId } });
      const initialSv = preUser!.securityVersion;

      const res = await request(app)
        .post(`/clubs/${testClubId}/members`)
        .set('Authorization', `Bearer ${primaryClubAdminToken}`)
        .send({ user_id: unauthorizedUserId, role: 'CORE_MEMBER' });
      
      assert.strictEqual(res.status, 201);

      const postUser = await adminPrisma.user.findUnique({ where: { id: unauthorizedUserId } });
      assert.ok(postUser!.securityVersion > initialSv);
    });
  });
});
