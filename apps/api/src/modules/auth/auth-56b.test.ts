import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../../app';
import { prisma } from '../../lib/prisma';
import { sign } from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

function generateToken(userId: string) {
  return sign({ sub: userId }, JWT_SECRET, { expiresIn: '1h' });
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

  beforeAll(async () => {
    // 1. Create Users
    const createRes = await prisma.user.createManyAndReturn({
      data: [
        { email: 'plat@admin.com', globalRole: 'PLATFORM_ADMIN' },
        { email: 'fac@admin.com', globalRole: 'FACULTY_ADMIN' },
        { email: 'prim@club.com', globalRole: 'STUDENT' },
        { email: 'collab@club.com', globalRole: 'STUDENT' },
        { email: 'unauth@student.com', globalRole: 'STUDENT' },
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
    const program = await prisma.academicProgram.create({
      data: { name: 'Test Program', code: 'TP', createdById: platformAdminId },
    });
    testProgramId = program.id;

    const batch = await prisma.academicBatch.create({
      data: {
        programId: testProgramId,
        admissionYear: 2024,
        graduationYear: 2028,
        createdById: platformAdminId,
      },
    });
    testBatchId = batch.id;

    // 3. Create Clubs
    const club1 = await prisma.club.create({
      data: { name: 'Primary Club', description: 'Test', createdById: platformAdminId },
    });
    testClubId = club1.id;

    const club2 = await prisma.club.create({
      data: { name: 'Collab Club', description: 'Test', createdById: platformAdminId },
    });
    collabClubId = club2.id;

    // 4. Assign Club Memberships
    await prisma.clubMembership.create({
      data: { clubId: testClubId, userId: primaryClubAdminId, role: 'CLUB_ADMIN' },
    });
    await prisma.clubMembership.create({
      data: { clubId: collabClubId, userId: collaboratingClubAdminId, role: 'CLUB_ADMIN' },
    });

    // 5. Create Event with Primary and Collaborating Club
    const event = await prisma.event.create({
      data: {
        title: 'Test Event 56B',
        description: 'Test',
        state: 'DRAFT',
        visibility: 'PUBLIC',
        audience: 'ALL_STUDENTS',
        startTime: new Date(),
        endTime: new Date(Date.now() + 3600000),
        registrationType: 'INDIVIDUAL',
        createdById: primaryClubAdminId,
      },
    });
    testEventId = event.id;

    await prisma.eventClub.create({
      data: { eventId: testEventId, clubId: testClubId, isPrimary: true },
    });
    await prisma.eventClub.create({
      data: { eventId: testEventId, clubId: collabClubId, isPrimary: false },
    });
  });

  afterAll(async () => {
    // Cleanup
    await prisma.eventClub.deleteMany();
    await prisma.event.deleteMany();
    await prisma.clubMembership.deleteMany();
    await prisma.club.deleteMany();
    await prisma.academicBatch.deleteMany();
    await prisma.academicProgram.deleteMany();
    await prisma.user.deleteMany();
  });

  describe('Events: isPrimary validation', () => {
    it('allows Primary Club Admin to update event', async () => {
      const res = await request(app)
        .patch(`/v1/events/${testEventId}`)
        .set('Authorization', `Bearer ${primaryClubAdminToken}`)
        .send({ title: 'Updated Title' });
      expect(res.status).toBe(200);
    });

    it('denies Collaborating Club Admin from updating event', async () => {
      const res = await request(app)
        .patch(`/v1/events/${testEventId}`)
        .set('Authorization', `Bearer ${collaboratingClubAdminToken}`)
        .send({ title: 'Hacked Title' });
      expect(res.status).toBe(403);
    });
  });

  describe('Directory Access', () => {
    it('allows PLATFORM_ADMIN to view users directory', async () => {
      const res = await request(app)
        .get('/v1/admin/users')
        .set('Authorization', `Bearer ${platformAdminToken}`);
      expect(res.status).toBe(200);
    });

    it('allows FACULTY_ADMIN to view users directory', async () => {
      const res = await request(app)
        .get('/v1/admin/users')
        .set('Authorization', `Bearer ${facultyAdminToken}`);
      expect(res.status).toBe(200);
    });

    it('denies PLATFORM_ADMIN mutating students directory from unauthorized', async () => {
      const res = await request(app)
        .post('/v1/admin/students')
        .set('Authorization', `Bearer ${facultyAdminToken}`)
        .send({ email: 'new@student.com' });
      expect(res.status).toBe(403);
    });
  });

  describe('securityVersion Increment on Role Change', () => {
    it('increments securityVersion when a user is added to a club', async () => {
      const preUser = await prisma.user.findUnique({ where: { id: unauthorizedUserId } });
      const initialSv = preUser!.securityVersion;

      const res = await request(app)
        .post(`/v1/clubs/${testClubId}/members`)
        .set('Authorization', `Bearer ${primaryClubAdminToken}`)
        .send({ user_id: unauthorizedUserId, role: 'CORE_MEMBER' });
      
      expect(res.status).toBe(201);

      const postUser = await prisma.user.findUnique({ where: { id: unauthorizedUserId } });
      expect(postUser!.securityVersion).toBeGreaterThan(initialSv);
    });
  });
});
