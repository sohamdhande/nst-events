import request from 'supertest';
import { createApp } from '../src/app';
import { adminPrisma } from './helpers/adminDb';
import { signJwt } from '../src/lib/jwt';
import { authService } from '../src/modules/auth/auth.service';
import * as googleOauth from '../src/modules/auth/google.oauth';
import { OAuth2Client } from 'google-auth-library';
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { randomUUID } from 'crypto';
import sinon from 'sinon';

describe('Admin Identity E2E Tests', () => {
  let platformAdmin1Token: string;
  let platformAdmin1Id: string;
  const app = createApp();

  before(async () => {
    platformAdmin1Id = randomUUID();
    const adminUser = await adminPrisma.user.create({
      data: {
        id: platformAdmin1Id,
        googleSub: 'google-sub-admin-1-' + platformAdmin1Id,
        email: `e25b070564+${platformAdmin1Id}@adypu.edu.in`,
        fullName: 'Platform Admin 1',
        globalRole: 'PLATFORM_ADMIN',
        securityVersion: 1,
      },
    });
    platformAdmin1Token = signJwt(adminUser.id, adminUser.securityVersion);
  });

  after(async () => {
    sinon.restore();
  });

  it('1. Last Platform Admin: Should prevent mutual demotion concurrently', async () => {
    const admin2 = await adminPrisma.user.create({
      data: {
        id: randomUUID(),
        googleSub: 'google-sub-admin-2-' + randomUUID(),
        email: `admin2+${randomUUID()}@adypu.edu.in`,
        fullName: 'Platform Admin 2',
        globalRole: 'PLATFORM_ADMIN',
        securityVersion: 1,
      }
    });
    const platformAdmin2Token = signJwt(admin2.id, admin2.securityVersion);

    const [res1, res2] = await Promise.all([
      request(app)
        .post(`/v1/admin/users/${admin2.id}/role`)
        .set('Authorization', `Bearer ${platformAdmin1Token}`)
        .send({ role: 'STUDENT' }),
      request(app)
        .post(`/v1/admin/users/${platformAdmin1Id}/role`)
        .set('Authorization', `Bearer ${platformAdmin2Token}`)
        .send({ role: 'STUDENT' })
    ]);

    const statuses = [res1.status, res2.status].sort();
    assert.deepStrictEqual(statuses, [200, 404]);
  });

  it('2. securityVersion & 3. JWT freshness: Role change revokes token immediately', async () => {
    const studentId = randomUUID();
    const student = await adminPrisma.user.create({
      data: {
        id: studentId,
        googleSub: 'google-sub-student-fresh-' + studentId,
        email: `fresh+${studentId}@adypu.edu.in`,
        globalRole: 'STUDENT',
        fullName: 'Student User',
        securityVersion: 1,
      }
    });

    const studentToken = signJwt(student.id, student.securityVersion);

    let res = await request(app).get('/v1/admin/users').set('Authorization', `Bearer ${studentToken}`);
    assert.strictEqual(res.status, 403);

    const activeAdminToken = (await adminPrisma.user.findUnique({ where: { id: platformAdmin1Id } }))?.globalRole === 'PLATFORM_ADMIN'
      ? platformAdmin1Token
      : signJwt((await adminPrisma.user.findFirst({ where: { globalRole: 'PLATFORM_ADMIN' } }))!.id, 1);

    await request(app)
      .post(`/v1/admin/users/${student.id}/role`)
      .set('Authorization', `Bearer ${activeAdminToken}`)
      .send({ role: 'FACULTY_ADMIN' })
      .expect(200);

    res = await request(app).get('/v1/admin/users').set('Authorization', `Bearer ${studentToken}`);
    assert.strictEqual(res.status, 401);
  });

  it('4. CSV Stream: Bounds and malformed behavior', async () => {
    const validEmail = `validstream+${randomUUID()}@adypu.edu.in`;
    const csvContent = `email\n${validEmail}\ninvalidstream@newtonschool.co\n`;
    const activeAdminToken = (await adminPrisma.user.findUnique({ where: { id: platformAdmin1Id } }))?.globalRole === 'PLATFORM_ADMIN'
      ? platformAdmin1Token
      : signJwt((await adminPrisma.user.findFirst({ where: { globalRole: 'PLATFORM_ADMIN' } }))!.id, 1);

    const res = await request(app)
      .post('/v1/admin/students/import')
      .set('Authorization', `Bearer ${activeAdminToken}`)
      .attach('file', Buffer.from(csvContent), 'students.csv');

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.added, 1);
    assert.strictEqual(res.body.rejected.length, 1);
    assert.strictEqual(res.body.rejected[0].email, 'invalidstream@newtonschool.co');
  });

  it('5. Newton accounts: Bypass directory, default FACULTY_MENTOR', async () => {
    sinon.restore(); // Ensure clean state
    const fakeSub = 'google-sub-newton-' + randomUUID();
    sinon.stub(OAuth2Client.prototype, 'getToken').resolves({ tokens: { id_token: 'fake-id-token' } } as any);
    sinon.stub(OAuth2Client.prototype, 'verifyIdToken').resolves({
      getPayload: () => ({
        email: `staff+${randomUUID()}@newtonschool.co`,
        sub: fakeSub,
        name: 'Newton Staff',
      })
    } as any);

    const res = await authService.loginWithGoogle('fake-code', null, null);
    assert.strictEqual(res.user.global_role, 'FACULTY_MENTOR');
    sinon.restore();
  });

  it('6. Student eligibility: Rejected before access if not in directory', async () => {
    sinon.restore(); // Ensure clean state
    let error: any = null;
    const fakeSub = 'google-sub-adypu-' + randomUUID();
    sinon.stub(OAuth2Client.prototype, 'getToken').resolves({ tokens: { id_token: 'fake-id-token' } } as any);
    sinon.stub(OAuth2Client.prototype, 'verifyIdToken').resolves({
      getPayload: () => ({
        email: `unauthorized+${randomUUID()}@adypu.edu.in`,
        sub: fakeSub,
        name: 'Unauthorized Student',
      })
    } as any);

    try {
      await authService.loginWithGoogle('fake-code', null, null);
    } catch (err) {
      error = err;
    }
    assert.notStrictEqual(error, null);
    assert.strictEqual(error.message, 'STUDENT_ACCESS_NOT_AUTHORIZED');
    sinon.restore();
  });

  it('7. Student removal: Does not delete User data, increments securityVersion', async () => {
    const studentEmail = `remove+${randomUUID()}@adypu.edu.in`;
    const authStudent = await adminPrisma.authorizedStudent.create({
      data: { normalizedEmail: studentEmail, status: 'ACTIVE' }
    });

    const studentUser = await adminPrisma.user.create({
      data: {
        id: randomUUID(),
        googleSub: 'google-remove-' + randomUUID(),
        email: studentEmail,
        globalRole: 'STUDENT',
        fullName: 'Removed Student',
        securityVersion: 1,
      }
    });

    const tokenBefore = signJwt(studentUser.id, studentUser.securityVersion);

    const activeAdminToken = (await adminPrisma.user.findUnique({ where: { id: platformAdmin1Id } }))?.globalRole === 'PLATFORM_ADMIN'
      ? platformAdmin1Token
      : signJwt((await adminPrisma.user.findFirst({ where: { globalRole: 'PLATFORM_ADMIN' } }))!.id, 1);

    await request(app)
      .delete(`/v1/admin/students/${authStudent.id}`)
      .set('Authorization', `Bearer ${activeAdminToken}`)
      .expect(204);

    const res = await request(app).get('/v1/admin/users').set('Authorization', `Bearer ${tokenBefore}`);
    assert.strictEqual(res.status, 401);

    const userAfter = await adminPrisma.user.findUnique({ where: { id: studentUser.id } });
    assert.notStrictEqual(userAfter, null);
    assert.strictEqual(userAfter?.deletedAt, null);
  });

  it('8. Global vs Club roles: Global role changes leave ClubMembership untouched', async () => {
    const clubId = randomUUID();
    await adminPrisma.club.create({
      data: { id: clubId, name: 'Test Club ' + clubId }
    });

    const studentUser = await adminPrisma.user.create({
      data: {
        id: randomUUID(),
        googleSub: 'google-sub-club-' + randomUUID(),
        email: `club+${randomUUID()}@adypu.edu.in`,
        fullName: 'Club Student',
        globalRole: 'STUDENT',
        securityVersion: 1,
      },
    });

    await adminPrisma.clubMembership.create({
      data: { userId: studentUser.id, clubId: clubId, role: 'CLUB_ADMIN' }
    });

    const activeAdminToken = (await adminPrisma.user.findUnique({ where: { id: platformAdmin1Id } }))?.globalRole === 'PLATFORM_ADMIN'
      ? platformAdmin1Token
      : signJwt((await adminPrisma.user.findFirst({ where: { globalRole: 'PLATFORM_ADMIN' } }))!.id, 1);

    await request(app)
      .post(`/v1/admin/users/${studentUser.id}/role`)
      .set('Authorization', `Bearer ${activeAdminToken}`)
      .send({ role: 'FACULTY_ADMIN' })
      .expect(200);

    const membership = await adminPrisma.clubMembership.findFirst({
      where: { userId: studentUser.id, clubId: clubId },
    });
    assert.strictEqual(membership?.role, 'CLUB_ADMIN');
  });
});
