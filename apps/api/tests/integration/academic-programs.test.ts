import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { PrismaClient } from '@nst/database';
import { adminPrisma } from '../helpers/adminDb';
import { createApp } from '../../src/app';
import { signJwt } from '../../src/lib/jwt';

const prisma = new PrismaClient();
const app = createApp();

test('Phase API-FACULTY-ADMIN-ACADEMIC-PROGRAMS API', async (t) => {
  let platformAdminToken: string;
  let facultyAdminToken: string;
  let clubAdminToken: string;
  let coreMemberToken: string;
  let studentToken: string;
  let existingProgramId: string;

  t.before(async () => {
    await adminPrisma.eventRegistration.deleteMany({});
    await adminPrisma.attendanceRecord.deleteMany({});
    await adminPrisma.attendanceSession.deleteMany({});
    await adminPrisma.teamInvitation.deleteMany({});
    await adminPrisma.team.deleteMany({});
    await adminPrisma.eventAudienceBatch.deleteMany({});
    await adminPrisma.eventClub.deleteMany({});
    await adminPrisma.event.deleteMany({});
    await adminPrisma.userAcademicProfile.deleteMany({});
    await adminPrisma.academicBatch.deleteMany({});
    await adminPrisma.academicProgram.deleteMany({});
    await adminPrisma.clubMembership.deleteMany({});
    await adminPrisma.club.deleteMany({ where: { name: 'Test Club' } });
    await adminPrisma.user.deleteMany({ 
      where: { 
        email: { 
          in: ['pa@newtonschool.co', 'fa@newtonschool.co', 'student@adypu.edu.in', 'ca@adypu.edu.in', 'cm@adypu.edu.in'] 
        } 
      } 
    });

    const pa = await adminPrisma.user.create({
      data: {
        email: 'pa@newtonschool.co',
        fullName: 'PA',
        globalRole: 'PLATFORM_ADMIN',
        googleSub: 'google-pa',
      },
    });
    platformAdminToken = signJwt(pa.id);

    const fa = await adminPrisma.user.create({
      data: {
        email: 'fa@newtonschool.co',
        fullName: 'FA',
        globalRole: 'FACULTY_ADMIN',
        googleSub: 'google-fa',
      },
    });
    facultyAdminToken = signJwt(fa.id);

    const st = await adminPrisma.user.create({
      data: {
        email: 'student@adypu.edu.in',
        fullName: 'Student',
        globalRole: 'STUDENT',
        googleSub: 'google-st',
      },
    });
    studentToken = signJwt(st.id);

    const ca = await adminPrisma.user.create({
      data: {
        email: 'ca@adypu.edu.in',
        fullName: 'Club Admin',
        globalRole: 'STUDENT',
        googleSub: 'google-ca',
      },
    });
    clubAdminToken = signJwt(ca.id);

    const cm = await adminPrisma.user.create({
      data: {
        email: 'cm@adypu.edu.in',
        fullName: 'Core Member',
        globalRole: 'STUDENT',
        googleSub: 'google-cm',
      },
    });
    coreMemberToken = signJwt(cm.id);

    const club = await adminPrisma.club.create({
      data: {
        name: 'Test Club',
        description: 'Test',
        status: 'ACTIVE',
      }
    });

    await adminPrisma.clubMembership.createMany({
      data: [
        { clubId: club.id, userId: ca.id, role: 'CLUB_ADMIN' },
        { clubId: club.id, userId: cm.id, role: 'CORE_MEMBER' },
      ]
    });

    const programA = await adminPrisma.academicProgram.create({
      data: { name: 'B.Tech CSE', code: 'ENG-CSE' },
    });
    const programB = await adminPrisma.academicProgram.create({
      data: { name: 'B.Tech ECE', code: 'ENG-ECE' },
    });
    
    existingProgramId = programA.id;

    await adminPrisma.academicBatch.createMany({
      data: [
        { programId: programA.id, admissionYear: 2023, graduationYear: 2027 },
        { programId: programB.id, admissionYear: 2023, graduationYear: 2027 },
      ],
    });
  });

  t.after(async () => {
    // Let the test runner handle process exit and connection teardown
  });

  await t.test('1. PLATFORM_ADMIN receives 200 and list', async () => {
    const res = await request(app)
      .get('/v1/academic-programs')
      .set('Authorization', `Bearer ${platformAdminToken}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.length, 2);

    const programs = res.body;
    assert.strictEqual(programs[0].name, 'B.Tech CSE');
    assert.strictEqual(programs[0].code, 'ENG-CSE');
    assert.strictEqual(programs[0].batchCount, 1);
  });

  await t.test('2. FACULTY_ADMIN receives 200 on GET', async () => {
    const res = await request(app)
      .get('/v1/academic-programs')
      .set('Authorization', `Bearer ${facultyAdminToken}`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.length, 2);
  });

  await t.test('3. Authorized CLUB_ADMIN receives 200 on GET', async () => {
    const res = await request(app)
      .get('/v1/academic-programs')
      .set('Authorization', `Bearer ${clubAdminToken}`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.length, 2);
  });

  await t.test('4. CORE_MEMBER receives 200 on GET', async () => {
    const res = await request(app)
      .get('/v1/academic-programs')
      .set('Authorization', `Bearer ${coreMemberToken}`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.length, 2);
  });

  await t.test('5. Unauthorized STUDENT receives 403 on GET', async () => {
    const res = await request(app)
      .get('/v1/academic-programs')
      .set('Authorization', `Bearer ${studentToken}`);
    assert.strictEqual(res.status, 403);
  });

  await t.test('6. Unauthenticated request receives 401 on GET', async () => {
    const res = await request(app)
      .get('/v1/academic-programs');
    assert.strictEqual(res.status, 401);
  });
  
  await t.test('7. PLATFORM_ADMIN receives 201 on POST', async () => {
    const res = await request(app)
      .post('/v1/admin/academic-programs')
      .set('Authorization', `Bearer ${platformAdminToken}`)
      .send({ name: 'B.Tech IT', code: 'ENG-IT' });
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.name, 'B.Tech IT');
  });
  
  await t.test('8. PLATFORM_ADMIN receives 200 on PATCH', async () => {
    const res = await request(app)
      .patch(`/v1/admin/academic-programs/${existingProgramId}`)
      .set('Authorization', `Bearer ${platformAdminToken}`)
      .send({ name: 'B.Tech Computer Science' });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.name, 'B.Tech Computer Science');
  });

  await t.test('9. FACULTY_ADMIN receives 403 on POST', async () => {
    const res = await request(app)
      .post('/v1/admin/academic-programs')
      .set('Authorization', `Bearer ${facultyAdminToken}`)
      .send({ name: 'B.Tech Mechanical', code: 'ENG-MECH' });
    assert.strictEqual(res.status, 403);
  });

  await t.test('10. FACULTY_ADMIN receives 403 on PATCH', async () => {
    const res = await request(app)
      .patch(`/v1/admin/academic-programs/${existingProgramId}`)
      .set('Authorization', `Bearer ${facultyAdminToken}`)
      .send({ name: 'Hacked Name' });
    assert.strictEqual(res.status, 403);
  });
});
