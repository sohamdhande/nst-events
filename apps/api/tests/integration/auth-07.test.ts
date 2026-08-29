import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { PrismaClient, Prisma } from '@nst/database';
import { adminPrisma } from '../helpers/adminDb';
import { createApp } from '../../src/app';
import { signJwt } from '../../src/lib/jwt';
import { env } from '../../src/config/env';
import sinon from 'sinon';
import { googleOAuth } from '../../src/modules/auth/google.oauth';
import { authService } from '../../src/modules/auth/auth.service';

const prisma = new PrismaClient(); // Connects as nst_app via DATABASE_URL
const app = createApp();

test('Phase AUTH-07 - Academic Profile RLS & Concurrency', async (t) => {
  let platformAdminToken: string;
  let student1Token: string;
  let student1Id: string;
  let student2Id: string;
  let batchId: string;

  t.before(async () => {
    // Teardown first
    await adminPrisma.userAcademicProfile.deleteMany({});
    await adminPrisma.academicBatch.deleteMany({});
    await adminPrisma.academicProgram.deleteMany({});
    await adminPrisma.user.deleteMany({
      where: { email: { in: ['admin@newtonschool.co', 'st1@adypu.edu.in', 'st2@adypu.edu.in', 'e25concurrent1@adypu.edu.in', 'f25concurrent2@adypu.edu.in'] } }
    });
    await adminPrisma.authorizedStudent.deleteMany({
      where: { normalizedEmail: { in: ['st1@adypu.edu.in', 'st2@adypu.edu.in', 'e25concurrent1@adypu.edu.in', 'f25concurrent2@adypu.edu.in'] } }
    });

    const pa = await adminPrisma.user.create({
      data: {
        email: 'admin@newtonschool.co', fullName: 'PA', globalRole: 'PLATFORM_ADMIN', googleSub: 'pa',
      }
    });
    platformAdminToken = signJwt(pa.id);

    const st1 = await adminPrisma.user.create({
      data: {
        email: 'st1@adypu.edu.in', fullName: 'St1', globalRole: 'STUDENT', googleSub: 'st1',
      }
    });
    student1Id = st1.id;
    student1Token = signJwt(st1.id);

    const st2 = await adminPrisma.user.create({
      data: {
        email: 'st2@adypu.edu.in', fullName: 'St2', globalRole: 'STUDENT', googleSub: 'st2',
      }
    });
    student2Id = st2.id;

    const prog = await adminPrisma.academicProgram.create({
      data: { name: 'Test Prog', code: 'TEST' }
    });
    const batch = await adminPrisma.academicBatch.create({
      data: { programId: prog.id, admissionYear: 2021, graduationYear: 2025 }
    });
    batchId = batch.id;
  });

  t.afterEach(() => {
    sinon.restore();
  });

  t.after(async () => {
    await prisma.$disconnect();
    // Teardown
    await adminPrisma.userAcademicProfile.deleteMany({});
    await adminPrisma.academicBatch.deleteMany({});
    await adminPrisma.academicProgram.deleteMany({});
    await adminPrisma.eventRegistration.deleteMany({});
    await adminPrisma.teamInvitation.deleteMany({});
    await adminPrisma.team.deleteMany({});
    await adminPrisma.event.deleteMany({});
    await adminPrisma.clubMembership.deleteMany({});
    await adminPrisma.club.deleteMany({});
    await adminPrisma.user.deleteMany({});
    await adminPrisma.authorizedStudent.deleteMany({});
  });

  await t.test('1. nst_app cannot create profile for arbitrary user', async () => {
    // Simulate nst_app direct DB access under st1 context
    await prisma.$executeRaw`SELECT set_config('app.user_id', ${student1Id}::text, false)`;
    
    await assert.rejects(
      prisma.$executeRaw`
        INSERT INTO user_academic_profiles (id, user_id, batch_id, assignment_source)
        VALUES (gen_random_uuid(), ${student2Id}::uuid, ${batchId}::uuid, 'INSTITUTIONAL_EMAIL_INFERENCE')
      `,
      (err: any) => err.code === 'P2010' && err.message.includes('42501'),
      'RLS should deny cross-user insert'
    );
  });

  await t.test('2. nst_app cannot update arbitrary users profile', async () => {
    // Create profile for st2 using adminPrisma
    await adminPrisma.userAcademicProfile.create({
      data: { userId: student2Id, batchId, assignmentSource: 'ADMIN_OVERRIDE' }
    });

    await prisma.$executeRaw`SELECT set_config('app.user_id', ${student1Id}::text, false)`;

    // Try to update st2 profile as st1
    const affectedRows = await prisma.$executeRaw`
        UPDATE user_academic_profiles SET assignment_source = 'INSTITUTIONAL_EMAIL_INFERENCE' WHERE user_id = ${student2Id}::uuid
      `;
    assert.strictEqual(affectedRows, 0, 'RLS should silently filter out cross-user update (0 rows affected)');
    
    // Clean up profile for next tests
    await adminPrisma.userAcademicProfile.deleteMany({ where: { userId: student2Id } });
  });

  await t.test('7-9, 12. Concurrent Google login creates correct single state', async () => {
    const email = 'e25concurrent1@adypu.edu.in';
    const sub = 'sub-concurrent1';
    await adminPrisma.authorizedStudent.create({ data: { normalizedEmail: email } });
    
    // Stub google auth
    sinon.stub(googleOAuth, 'exchangeCodeForTokens').resolves({ id_token: 'fake-id-token', access_token: 'fake', refresh_token: 'fake', expires_in: 3600, scope: 'openid', token_type: 'Bearer' });
    sinon.stub(googleOAuth, 'verifyIdToken').resolves({ sub, email, name: 'Concurrent 1' } as any);

    const prog = await adminPrisma.academicProgram.create({ data: { name: 'Prog B', code: 'e' } });
    await adminPrisma.academicBatch.create({ data: { programId: prog.id, admissionYear: 2025, graduationYear: 2029 } });

    // Make concurrent requests
    const promises = [
      authService.loginWithGoogle('fake-code-1'),
      authService.loginWithGoogle('fake-code-2'),
      authService.loginWithGoogle('fake-code-3')
    ];

    const results = await Promise.all(promises);

    for (const res of results) {
      assert.ok(res.access_token);
    }

    // Verify DB state
    const users = await adminPrisma.user.findMany({ where: { email } });
    assert.strictEqual(users.length, 1, 'Only one user should be created');

    const profiles = await adminPrisma.userAcademicProfile.findMany({ where: { userId: users[0].id } });
    assert.strictEqual(profiles.length, 1, 'Only one academic profile should be created');
  });

  await t.test('13. ADMIN_OVERRIDE remains authoritative', async () => {
    const email = 'f25concurrent2@adypu.edu.in';
    const sub = 'sub-concurrent2';
    await adminPrisma.authorizedStudent.create({ data: { normalizedEmail: email } });

    const prog = await adminPrisma.academicProgram.create({ data: { name: 'Prog C', code: 'f' } });
    const batchInferred = await adminPrisma.academicBatch.create({ data: { programId: prog.id, admissionYear: 2025, graduationYear: 2029 } });
    const batchAdmin = await adminPrisma.academicBatch.create({ data: { programId: prog.id, admissionYear: 2024, graduationYear: 2028 } });

    // Pre-create user and admin override profile
    const user = await adminPrisma.user.create({
      data: { email, fullName: 'Concurrent 2', googleSub: sub, globalRole: 'STUDENT' }
    });
    await adminPrisma.userAcademicProfile.create({
      data: { userId: user.id, batchId: batchAdmin.id, assignmentSource: 'ADMIN_OVERRIDE' }
    });

    sinon.restore();
    sinon.stub(googleOAuth, 'exchangeCodeForTokens').resolves({ id_token: 'fake-id-token', access_token: 'fake', refresh_token: 'fake', expires_in: 3600, scope: 'openid', token_type: 'Bearer' });
    sinon.stub(googleOAuth, 'verifyIdToken').resolves({ sub, email, name: 'Concurrent 2' } as any);

    const promises = [
      authService.loginWithGoogle('fake-code-4'),
      authService.loginWithGoogle('fake-code-5')
    ];

    await Promise.all(promises);

    const profiles = await adminPrisma.userAcademicProfile.findMany({ where: { userId: user.id } });
    assert.strictEqual(profiles.length, 1);
    assert.strictEqual(profiles[0].batchId, batchAdmin.id, 'Admin override should be preserved');
    assert.strictEqual(profiles[0].assignmentSource, 'ADMIN_OVERRIDE');
  });
});
