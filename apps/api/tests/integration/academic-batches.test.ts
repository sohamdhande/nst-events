import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { PrismaClient } from '@nst/database';
import { adminPrisma } from '../helpers/adminDb';
import { createApp } from '../../src/app';
import { signJwt } from '../../src/lib/jwt';

const prisma = new PrismaClient();
const app = createApp();

test('Phase UI-17A Academic Batches API', async (t) => {
  let platformAdminToken: string;
  let facultyAdminToken: string;
  let clubAdminToken: string;
  let coreMemberToken: string;
  let studentToken: string;

  t.before(async () => {
    await adminPrisma.userAcademicProfile.deleteMany({});
    await adminPrisma.academicBatch.deleteMany({});
    await adminPrisma.academicProgram.deleteMany({});
    await adminPrisma.eventRegistration.deleteMany({});
    await adminPrisma.teamInvitation.deleteMany({});
    await adminPrisma.team.deleteMany({});
    await adminPrisma.eventClub.deleteMany({});
    await adminPrisma.event.deleteMany({});
    await adminPrisma.clubMembership.deleteMany({});
    await adminPrisma.club.deleteMany({});
    await adminPrisma.user.deleteMany({});

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

    await adminPrisma.academicBatch.createMany({
      data: [
        { programId: programA.id, admissionYear: 2023, graduationYear: 2027 },
        { programId: programA.id, admissionYear: 2024, graduationYear: 2028 },
        { programId: programB.id, admissionYear: 2023, graduationYear: 2027 },
      ],
    });
  });

  t.after(async () => {
    // Let the test runner handle process exit and connection teardown
  });

  await t.test('1. PLATFORM_ADMIN receives 200 and deterministic ordered list', async () => {
    const res = await request(app)
      .get('/v1/academic-batches')
      .set('Authorization', `Bearer ${platformAdminToken}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.length, 3);

    const batches = res.body;
    assert.strictEqual(batches[0].program.name, 'B.Tech CSE');
    assert.strictEqual(batches[0].admission_year, 2023);
    
    assert.strictEqual(batches[1].program.name, 'B.Tech CSE');
    assert.strictEqual(batches[1].admission_year, 2024);

    assert.strictEqual(batches[2].program.name, 'B.Tech ECE');
    assert.strictEqual(batches[2].admission_year, 2023);

    assert.strictEqual(batches[0].display_name, 'B.Tech CSE — 2023–2027');
    assert.ok(batches[0].id);
    assert.ok(batches[0].program.id);
    assert.strictEqual(batches[0].program.code, 'ENG-CSE');

    assert.strictEqual(batches[0].profiles, undefined);
    assert.strictEqual(batches[0].user_assignments, undefined);
  });

  await t.test('2. FACULTY_ADMIN receives 200', async () => {
    const res = await request(app)
      .get('/v1/academic-batches')
      .set('Authorization', `Bearer ${facultyAdminToken}`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.length, 3);
  });

  await t.test('3. Authorized CLUB_ADMIN receives 200', async () => {
    const res = await request(app)
      .get('/v1/academic-batches')
      .set('Authorization', `Bearer ${clubAdminToken}`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.length, 3);
  });

  await t.test('4. CORE_MEMBER receives 200', async () => {
    const res = await request(app)
      .get('/v1/academic-batches')
      .set('Authorization', `Bearer ${coreMemberToken}`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.length, 3);
  });

  await t.test('5. Unauthorized STUDENT receives 403', async () => {
    const res = await request(app)
      .get('/v1/academic-batches')
      .set('Authorization', `Bearer ${studentToken}`);
    assert.strictEqual(res.status, 403);
  });

  await t.test('6. Unauthenticated request receives 401', async () => {
    const res = await request(app)
      .get('/v1/academic-batches');
    assert.strictEqual(res.status, 401);
  });
});
