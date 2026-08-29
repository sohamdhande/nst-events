import { describe, it, beforeAll, afterAll } from 'vitest';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../../src/app';
import { adminPrisma as prisma } from '../helpers/adminDb';
import { signJwt } from '../../src/lib/jwt';
import { AssignmentSource } from '@nst/database';

describe('FACULTY-USERS-04: Target-Aware Academic Batch Authorization', () => {
  let platformAdminToken: string;
  let facultyAdminToken: string;
  let ordinaryToken: string;

  let platformAdminId: string;
  let facultyAdminId: string;
  let ordinaryId: string;

  let targetStudent: string;
  let targetClubAdmin: string;
  let targetMentor: string;
  let targetFacultyAdmin: string;
  let targetPlatformAdmin: string;

  let batchId: string;
  let app: any;

  beforeAll(async () => {
    app = createApp();
    
    // Create admins
    const pAdmin = await prisma.user.create({ data: { email: 'pa04@example.com', globalRole: 'PLATFORM_ADMIN', fullName: 'PA', googleSub: 'pa04' } });
    platformAdminId = pAdmin.id;
    platformAdminToken = signJwt(pAdmin.id);

    const fAdmin = await prisma.user.create({ data: { email: 'fa04@example.com', globalRole: 'FACULTY_ADMIN', fullName: 'FA', googleSub: 'fa04' } });
    facultyAdminId = fAdmin.id;
    facultyAdminToken = signJwt(fAdmin.id);

    const ord = await prisma.user.create({ data: { email: 'ord04@example.com', globalRole: 'STUDENT', fullName: 'Ord', googleSub: 'ord04' } });
    ordinaryId = ord.id;
    ordinaryToken = signJwt(ord.id);

    // Create target users
    const ts = await prisma.user.create({ data: { email: 'ts04@example.com', globalRole: 'STUDENT', fullName: 'TS', googleSub: 'ts04' } });
    targetStudent = ts.id;

    const club = await prisma.club.create({ data: { name: 'Test Club 04' } });
    const tca = await prisma.user.create({ data: { email: 'tca04@example.com', globalRole: 'STUDENT', fullName: 'TCA', googleSub: 'tca04', clubMemberships: { create: { clubId: club.id, role: 'CLUB_ADMIN' } } } });
    targetClubAdmin = tca.id;

    const tm = await prisma.user.create({ data: { email: 'tm04@example.com', globalRole: 'FACULTY_MENTOR', fullName: 'TM', googleSub: 'tm04' } });
    targetMentor = tm.id;

    const tfa = await prisma.user.create({ data: { email: 'tfa04@example.com', globalRole: 'FACULTY_ADMIN', fullName: 'TFA', googleSub: 'tfa04' } });
    targetFacultyAdmin = tfa.id;

    const tpa = await prisma.user.create({ data: { email: 'tpa04@example.com', globalRole: 'PLATFORM_ADMIN', fullName: 'TPA', googleSub: 'tpa04' } });
    targetPlatformAdmin = tpa.id;

    // Create an academic batch to assign
    const program = await prisma.academicProgram.create({ data: { code: 'TEST04', name: 'Test Program 04' } });
    const batch = await prisma.academicBatch.create({ data: { programId: program.id, admissionYear: 2024, graduationYear: 2028 } });
    batchId = batch.id;
  });

  afterAll(async () => {
    // Delete in reverse order of dependencies
    await prisma.userAcademicProfile.deleteMany();
    await prisma.academicBatch.deleteMany({ where: { id: batchId } });
    await prisma.academicProgram.deleteMany({ where: { code: 'TEST04' } });
    
    await prisma.clubMembership.deleteMany();
    await prisma.club.deleteMany({ where: { name: 'Test Club 04' } });
    
    await prisma.user.deleteMany({ where: { id: { in: [
      platformAdminId, facultyAdminId, ordinaryId,
      targetStudent, targetClubAdmin, targetMentor, targetFacultyAdmin, targetPlatformAdmin
    ] } } });
  });

  // FACULTY_ADMIN tests
  it('FACULTY_ADMIN + STUDENT -> succeeds', async () => {
    const res = await request(app).patch(`/v1/admin/users/${targetStudent}/academic-batch`).set('Authorization', `Bearer ${facultyAdminToken}`).send({ batchId });
    assert.equal(res.status, 200);
    assert.equal(res.body.batchId, batchId);
  });

  it('FACULTY_ADMIN + CLUB_ADMIN -> 403', async () => {
    const res = await request(app).patch(`/v1/admin/users/${targetClubAdmin}/academic-batch`).set('Authorization', `Bearer ${facultyAdminToken}`).send({ batchId });
    assert.equal(res.status, 403);
  });

  it('FACULTY_ADMIN + FACULTY_MENTOR -> 403', async () => {
    const res = await request(app).patch(`/v1/admin/users/${targetMentor}/academic-batch`).set('Authorization', `Bearer ${facultyAdminToken}`).send({ batchId });
    assert.equal(res.status, 403);
  });

  it('FACULTY_ADMIN + FACULTY_ADMIN -> 403', async () => {
    const res = await request(app).patch(`/v1/admin/users/${targetFacultyAdmin}/academic-batch`).set('Authorization', `Bearer ${facultyAdminToken}`).send({ batchId });
    assert.equal(res.status, 403);
  });

  it('FACULTY_ADMIN + PLATFORM_ADMIN -> 403', async () => {
    const res = await request(app).patch(`/v1/admin/users/${targetPlatformAdmin}/academic-batch`).set('Authorization', `Bearer ${facultyAdminToken}`).send({ batchId });
    assert.equal(res.status, 403);
  });


  // PLATFORM_ADMIN tests
  it('PLATFORM_ADMIN + STUDENT -> succeeds', async () => {
    const res = await request(app).patch(`/v1/admin/users/${targetStudent}/academic-batch`).set('Authorization', `Bearer ${platformAdminToken}`).send({ batchId });
    assert.equal(res.status, 200);
    assert.equal(res.body.batchId, batchId);
  });

  it('PLATFORM_ADMIN + CLUB_ADMIN -> 403', async () => {
    const res = await request(app).patch(`/v1/admin/users/${targetClubAdmin}/academic-batch`).set('Authorization', `Bearer ${platformAdminToken}`).send({ batchId });
    assert.equal(res.status, 403);
  });

  it('PLATFORM_ADMIN + FACULTY_MENTOR -> 403', async () => {
    const res = await request(app).patch(`/v1/admin/users/${targetMentor}/academic-batch`).set('Authorization', `Bearer ${platformAdminToken}`).send({ batchId });
    assert.equal(res.status, 403);
  });

  it('PLATFORM_ADMIN + FACULTY_ADMIN -> 403', async () => {
    const res = await request(app).patch(`/v1/admin/users/${targetFacultyAdmin}/academic-batch`).set('Authorization', `Bearer ${platformAdminToken}`).send({ batchId });
    assert.equal(res.status, 403);
  });

  it('PLATFORM_ADMIN + PLATFORM_ADMIN -> 403', async () => {
    const res = await request(app).patch(`/v1/admin/users/${targetPlatformAdmin}/academic-batch`).set('Authorization', `Bearer ${platformAdminToken}`).send({ batchId });
    assert.equal(res.status, 403);
  });

  // Role Auth checks
  it('Unauthenticated -> 401', async () => {
    const res = await request(app).patch(`/v1/admin/users/${targetStudent}/academic-batch`).send({ batchId });
    assert.equal(res.status, 401);
  });

  it('Unauthorized ordinary role -> 403', async () => {
    const res = await request(app).patch(`/v1/admin/users/${targetStudent}/academic-batch`).set('Authorization', `Bearer ${ordinaryToken}`).send({ batchId });
    assert.equal(res.status, 403);
  });
});
