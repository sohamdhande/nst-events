import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import { app } from '../../src/app';
import { prisma } from '../../src/lib/prisma';
import { adminPrisma } from '../helpers/adminDb';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

function generateToken(userId: string) {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: '1h' });
}

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

  before(async () => {
    await adminPrisma.eventClub.deleteMany();
    await adminPrisma.event.deleteMany();
    await adminPrisma.clubMembership.deleteMany();
    await adminPrisma.club.deleteMany();
    await adminPrisma.academicBatch.deleteMany();
    await adminPrisma.academicProgram.deleteMany();
    await adminPrisma.user.deleteMany({ where: { googleSub: { startsWith: 'google-' } } });
    
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

    platformAdminToken = generateToken(platformAdminId);
    facultyAdminToken = generateToken(facultyAdminId);
    primaryClubAdminToken = generateToken(primaryClubAdminId);
    collaboratingClubAdminToken = generateToken(collaboratingClubAdminId);
    unauthorizedUserToken = generateToken(unauthorizedUserId);

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
    // Cleanup
    await adminPrisma.eventClub.deleteMany();
    await adminPrisma.event.deleteMany();
    await adminPrisma.clubMembership.deleteMany();
    await adminPrisma.club.deleteMany();
    await adminPrisma.academicBatch.deleteMany();
    await adminPrisma.academicProgram.deleteMany();
    await adminPrisma.user.deleteMany();
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
        .post(`/v1/clubs/${testClubId}/members`)
        .set('Authorization', `Bearer ${primaryClubAdminToken}`)
        .send({ user_id: unauthorizedUserId, role: 'CORE_MEMBER' });
      
      assert.strictEqual(res.status, 201);

      const postUser = await adminPrisma.user.findUnique({ where: { id: unauthorizedUserId } });
      assert.ok(postUser!.securityVersion > initialSv);
    });
  });
});
