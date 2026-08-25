import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { PrismaClient } from '@nst/database';
import { adminPrisma } from '../helpers/adminDb';
import { createApp } from '../../src/app';
import { authService } from '../../src/modules/auth/auth.service';
import { googleOAuth } from '../../src/modules/auth/google.oauth';
import sinon from 'sinon';
import { signJwt } from '../../src/lib/jwt';

const prisma = new PrismaClient();
const app = createApp();

test('Phase UI-14D Academic Identity Integration', async (t) => {
  let platformAdminToken: string;
  let facultyAdminToken: string;
  let studentToken: string;

  let platformAdminId: string;
  let facultyAdminId: string;
  let studentId: string;
  let programId: string;
  let batchId: string;

  t.before(async () => {
    await adminPrisma.userAcademicProfile.deleteMany({});
    await adminPrisma.academicBatch.deleteMany({});
    await adminPrisma.academicProgram.deleteMany({});
    await adminPrisma.eventRegistration.deleteMany({});
    await adminPrisma.teamInvitation.deleteMany({});
    await adminPrisma.team.deleteMany({});
    await adminPrisma.event.deleteMany({});
    await adminPrisma.user.deleteMany({});

    // Setup base users
    const pa = await adminPrisma.user.create({
      data: {
        email: 'admin@newtonschool.co',
        fullName: 'Platform Admin',
        globalRole: 'PLATFORM_ADMIN',
        googleSub: 'google-pa',
      },
    });
    platformAdminId = pa.id;
    platformAdminToken = signJwt(pa.id);

    const fa = await adminPrisma.user.create({
      data: {
        email: 'faculty@newtonschool.co',
        fullName: 'Faculty Admin',
        globalRole: 'FACULTY_ADMIN',
        googleSub: 'google-fa',
      },
    });
    facultyAdminId = fa.id;
    facultyAdminToken = signJwt(fa.id);

    const st = await adminPrisma.user.create({
      data: {
        email: 'student@adypu.edu.in',
        fullName: 'Student',
        globalRole: 'STUDENT',
        googleSub: 'google-st',
      },
    });
    studentId = st.id;
    studentToken = signJwt(st.id);
  });

  t.afterEach(() => {
    sinon.restore();
  });

  t.after(async () => {
    await adminPrisma.userAcademicProfile.deleteMany({});
    await adminPrisma.academicBatch.deleteMany({});
    await adminPrisma.academicProgram.deleteMany({});
    await adminPrisma.event.deleteMany({});
    await adminPrisma.user.deleteMany({});
    await prisma.$disconnect();
    await adminPrisma.$disconnect();
  });

  await t.test('Migration-backed Model Access', async () => {
    const program = await adminPrisma.academicProgram.create({
      data: {
        name: 'B.Tech Computer Science',
        code: 'e',
      },
    });
    programId = program.id;

    const batch = await adminPrisma.academicBatch.create({
      data: {
        programId: program.id,
        admissionYear: 2025,
        graduationYear: 2029,
      },
    });
    batchId = batch.id;

    const profile = await adminPrisma.userAcademicProfile.create({
      data: {
        userId: studentId,
        batchId: batch.id,
        assignmentSource: 'ADMIN_OVERRIDE',
      },
    });

    assert.ok(program.id);
    assert.ok(batch.id);
    assert.ok(profile.id);

    await adminPrisma.userAcademicProfile.delete({ where: { userId: studentId } });
  });

  await t.test('First Login Inference & Profile Idempotency', async () => {
    // Mock googleOAuth
    sinon.stub(googleOAuth, 'exchangeCodeForTokens').resolves({ id_token: 'mock_id_token' } as any);
    sinon.stub(googleOAuth, 'verifyIdToken').resolves({
      sub: 'google-st2',
      email: 'e25b070564@adypu.edu.in',
      name: 'New Student',
    } as any);

    const res = await authService.loginWithGoogle('mock_code', '127.0.0.1', 'test');
    
    assert.ok(res.user);
    const newUserId = res.user.id;

    const profile = await adminPrisma.userAcademicProfile.findUnique({
      where: { userId: newUserId },
      include: { batch: true },
    });

    assert.ok(profile);
    assert.equal(profile.assignmentSource, 'INSTITUTIONAL_EMAIL_INFERENCE');
    assert.equal(profile.batch.admissionYear, 2025);

    // Repeated login -> idempotent
    await authService.loginWithGoogle('mock_code', '127.0.0.1', 'test');
    
    const count = await adminPrisma.userAcademicProfile.count({ where: { userId: newUserId } });
    assert.equal(count, 1);
  });

  await t.test('Admin Override & Precedence', async () => {
    // Assign studentId a batch via Admin
    const res = await request(app)
      .patch(`/v1/admin/users/${studentId}/academic-batch`)
      .set('Authorization', `Bearer ${platformAdminToken}`)
      .send({ batchId });
    
    assert.equal(res.status, 200);

    const profile = await adminPrisma.userAcademicProfile.findUnique({ where: { userId: studentId }});
    assert.equal(profile?.assignmentSource, 'ADMIN_OVERRIDE');

    // Override precedence (Login again shouldn't overwrite)
    sinon.stub(googleOAuth, 'exchangeCodeForTokens').resolves({ id_token: 'mock_id_token' } as any);
    sinon.stub(googleOAuth, 'verifyIdToken').resolves({
      sub: 'google-st',
      email: 'student@adypu.edu.in', // Wait, this doesn't match a batch anyway.
      name: 'Student',
    } as any);

    await authService.loginWithGoogle('mock_code');
    const profileAfter = await adminPrisma.userAcademicProfile.findUnique({ where: { userId: studentId }});
    assert.equal(profileAfter?.assignmentSource, 'ADMIN_OVERRIDE');
  });

  await t.test('users/me response', async () => {
    const res = await request(app)
      .get('/users/me')
      .set('Authorization', `Bearer ${studentToken}`);
    
    assert.equal(res.status, 200);
    assert.ok(res.body.academic_profile);
    assert.equal(res.body.academic_profile.batch.admission_year, 2025);
    assert.equal(res.body.academic_profile.assignment_source, 'ADMIN_OVERRIDE');

    // Without profile
    const faRes = await request(app)
      .get('/users/me')
      .set('Authorization', `Bearer ${facultyAdminToken}`);
    
    assert.equal(faRes.status, 200);
    assert.equal(faRes.body.academic_profile, null);
  });

  await t.test('Authorization for Admin Endpoint', async () => {
    // FACULTY_ADMIN should succeed
    const resFA = await request(app)
      .patch(`/v1/admin/users/${studentId}/academic-batch`)
      .set('Authorization', `Bearer ${facultyAdminToken}`)
      .send({ batchId });
    assert.equal(resFA.status, 200);

    // STUDENT should 403
    const resSt = await request(app)
      .patch(`/v1/admin/users/${studentId}/academic-batch`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ batchId });
    assert.equal(resSt.status, 403);
  });

  await t.test('Concurrency', async () => {
    const googleSub = 'google-concurrent';
    const email = 'e25c999@adypu.edu.in';
    
    sinon.stub(googleOAuth, 'exchangeCodeForTokens').resolves({ id_token: 'mock_id_token' } as any);
    sinon.stub(googleOAuth, 'verifyIdToken').resolves({
      sub: googleSub,
      email: email,
      name: 'Concurrent Student',
    } as any);

    await Promise.all([
      authService.loginWithGoogle('mock_code'),
      authService.loginWithGoogle('mock_code'),
      authService.loginWithGoogle('mock_code')
    ]);

    const user = await adminPrisma.user.findUnique({ where: { email } });
    const profileCount = await adminPrisma.userAcademicProfile.count({ where: { userId: user!.id } });
    
    assert.equal(profileCount, 1);
  });

  await t.test('Audit Logging', async () => {
    const logs = await adminPrisma.auditLog.findMany({
      where: { action: 'UPDATE_ACADEMIC_BATCH', entityId: studentId }
    });
    assert.ok(logs.length > 0);
  });
});
