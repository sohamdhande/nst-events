import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import { createApp } from '../../src/app';
import { adminPrisma } from '../helpers/adminDb';
import { signJwt } from '../../src/lib/jwt';
import { randomUUID } from 'crypto';
import sinon from 'sinon';
import { OAuth2Client } from 'google-auth-library';
import { authService } from '../../src/modules/auth/auth.service';
import { env } from '../../src/config/env';
import { usersService } from '../../src/modules/admin/users.service';

describe('Adversarial Auth E2E Tests', () => {
  const app = createApp();

  after(async () => {
    sinon.restore();
  });

  async function mockGoogleLogin(email: string, sub: string, name = 'Test User') {
    sinon.restore();
    sinon.stub(OAuth2Client.prototype, 'getToken').resolves({ tokens: { id_token: 'fake-id-token' } } as any);
    sinon.stub(OAuth2Client.prototype, 'verifyIdToken').resolves({
      getPayload: () => ({ email, sub, name })
    } as any);
    
    return authService.loginWithGoogle('fake-code', null, null);
  }

  describe('Authentication Domains', () => {
    it('1. ADYPU authorized', async () => {
      const email = `auth1+${randomUUID()}@adypu.edu.in`;
      await adminPrisma.authorizedStudent.create({ data: { normalizedEmail: email, status: 'ACTIVE' } });
      const res = await mockGoogleLogin(email, `sub-auth1-${randomUUID()}`);
      assert.strictEqual(res.user.global_role, 'STUDENT');
    });

    it('2. ADYPU absent', async () => {
      const email = `auth2+${randomUUID()}@adypu.edu.in`;
      await assert.rejects(mockGoogleLogin(email, `sub-auth2-${randomUUID()}`), /STUDENT_ACCESS_NOT_AUTHORIZED/);
    });

    it('3. ADYPU REVOKED', async () => {
      const email = `auth3+${randomUUID()}@adypu.edu.in`;
      await adminPrisma.authorizedStudent.create({ data: { normalizedEmail: email, status: 'REVOKED' } });
      await assert.rejects(mockGoogleLogin(email, `sub-auth3-${randomUUID()}`), /STUDENT_ACCESS_NOT_AUTHORIZED/);
    });

    it('4. Newton new account', async () => {
      const email = `auth4+${randomUUID()}@newtonschool.co`;
      const res = await mockGoogleLogin(email, `sub-auth4-${randomUUID()}`);
      assert.strictEqual(res.user.global_role, 'FACULTY_MENTOR');
    });

    it('5. Newton FACULTY_ADMIN preserved', async () => {
      const email = `auth5+${randomUUID()}@newtonschool.co`;
      const sub = `sub-auth5-${randomUUID()}`;
      await adminPrisma.user.create({ data: { id: randomUUID(), email, googleSub: sub, fullName: 'FA', globalRole: 'FACULTY_ADMIN' } });
      const res = await mockGoogleLogin(email, sub);
      assert.strictEqual(res.user.global_role, 'FACULTY_ADMIN');
    });

    it('6. Unsupported domain', async () => {
      await assert.rejects(mockGoogleLogin(`auth6@gmail.com`, `sub-auth6-${randomUUID()}`), /INSTITUTIONAL_DOMAIN_NOT_ALLOWED/);
    });

    it('7. Mixed-case domain and whitespace', async () => {
      const emailLower = `auth7+${randomUUID()}@adypu.edu.in`;
      await adminPrisma.authorizedStudent.create({ data: { normalizedEmail: emailLower, status: 'ACTIVE' } });
      // Login with weird casing and spaces
      const res = await mockGoogleLogin(`  AUTH7+${emailLower.split('+')[1].split('@')[0]}@AdyPu.EDU.IN `, `sub-auth7-${randomUUID()}`);
      assert.strictEqual(res.user.global_role, 'STUDENT');
    });
  });

  describe('Authorization / Concurrency', () => {
    it('8. A demotes B while B demotes A', async () => {
      const aId = randomUUID();
      const bId = randomUUID();
      await adminPrisma.user.create({ data: { id: aId, email: `a+${aId}@adypu.edu.in`, googleSub: 'sub-a-' + aId, fullName: 'A', globalRole: 'PLATFORM_ADMIN', securityVersion: 1 } });
      await adminPrisma.user.create({ data: { id: bId, email: `b+${bId}@adypu.edu.in`, googleSub: 'sub-b-' + bId, fullName: 'B', globalRole: 'PLATFORM_ADMIN', securityVersion: 1 } });
      
      const tokenA = signJwt(aId, 1);
      const tokenB = signJwt(bId, 1);

      const [res1, res2] = await Promise.all([
        request(app).post(`/v1/admin/users/${bId}/role`).set('Authorization', `Bearer ${tokenA}`).send({ role: 'STUDENT' }),
        request(app).post(`/v1/admin/users/${aId}/role`).set('Authorization', `Bearer ${tokenB}`).send({ role: 'STUDENT' })
      ]);

      const statuses = [res1.status, res2.status].sort();
      // One succeeds (200), the other gets 404 because they lost visibility after being demoted, OR 403/500 if they caught LAST_PLATFORM_ADMIN.
      // With 2 platform admins, if A demotes B, there is 1 left (A). B's request will fail.
      assert.ok(statuses.includes(200), 'One must succeed');
      assert.ok(statuses.includes(404) || statuses.includes(403) || statuses.includes(500) || statuses.includes(401), 'One must fail safely');
      
      const pAdmins = await adminPrisma.user.count({ where: { globalRole: 'PLATFORM_ADMIN' } });
      assert.ok(pAdmins >= 1, 'Must never be zero');
    });

    it('9. Non-Platform Admin mutation attempts', async () => {
      const studentId = randomUUID();
      const mentorId = randomUUID();
      const adminId = randomUUID(); // Faculty Admin
      const targetId = randomUUID();

      await adminPrisma.user.create({ data: { id: studentId, email: `st+${studentId}@adypu.edu.in`, googleSub: 'sub-st-' + studentId, fullName: 'ST', globalRole: 'STUDENT' } });
      await adminPrisma.user.create({ data: { id: mentorId, email: `me+${mentorId}@newtonschool.co`, googleSub: 'sub-me-' + mentorId, fullName: 'ME', globalRole: 'FACULTY_MENTOR' } });
      await adminPrisma.user.create({ data: { id: adminId, email: `fa+${adminId}@newtonschool.co`, googleSub: 'sub-fa-' + adminId, fullName: 'FA', globalRole: 'FACULTY_ADMIN' } });
      await adminPrisma.user.create({ data: { id: targetId, email: `ta+${targetId}@adypu.edu.in`, googleSub: 'sub-ta-' + targetId, fullName: 'TA', globalRole: 'STUDENT' } });

      const tStudent = signJwt(studentId, 1);
      const tMentor = signJwt(mentorId, 1);
      const tAdmin = signJwt(adminId, 1);

      // Mutate role attempts
      for (const token of [tStudent, tMentor, tAdmin]) {
        const res = await request(app).post(`/v1/admin/users/${targetId}/role`).set('Authorization', `Bearer ${token}`).send({ role: 'PLATFORM_ADMIN' });
        assert.strictEqual(res.status, 403);
      }

      // Directory mutation attempts
      for (const token of [tStudent, tMentor]) {
        const res = await request(app).post(`/v1/admin/students`).set('Authorization', `Bearer ${token}`).send({ email: `test+${randomUUID()}@adypu.edu.in` });
        assert.strictEqual(res.status, 403);
      }
      
      // Faculty Admin CANNOT mutate directory either, only PLATFORM_ADMIN
      const resFa = await request(app).post(`/v1/admin/students`).set('Authorization', `Bearer ${tAdmin}`).send({ email: `test+${randomUUID()}@adypu.edu.in` });
      assert.strictEqual(resFa.status, 403);
    });
  });

  describe('Session Freshness', () => {
    it('10. API request fails instantly after directory revocation', async () => {
      const pId = randomUUID();
      const sId = randomUUID();
      const sEmail = `st_rev+${sId}@adypu.edu.in`;
      
      await adminPrisma.user.create({ data: { id: pId, email: `pa+${pId}@adypu.edu.in`, googleSub: 'sub-pa-' + pId, fullName: 'PA', globalRole: 'PLATFORM_ADMIN' } });
      await adminPrisma.authorizedStudent.create({ data: { normalizedEmail: sEmail, status: 'ACTIVE' } });
      const studentUser = await adminPrisma.user.create({ data: { id: sId, email: sEmail, googleSub: 'sub-st_rev-' + sId, fullName: 'ST', globalRole: 'STUDENT' } });
      
      const pToken = signJwt(pId, 1);
      const sToken = signJwt(sId, studentUser.securityVersion);

      // Verify student can access a protected route
      const res1 = await request(app).get('/users/me').set('Authorization', `Bearer ${sToken}`);
      assert.strictEqual(res1.status, 200);

      // Revoke directory access
      const authStudent = await adminPrisma.authorizedStudent.findUnique({ where: { normalizedEmail: sEmail } });
      const resRevoke = await request(app).delete(`/v1/admin/students/${authStudent!.id}`).set('Authorization', `Bearer ${pToken}`);
      assert.strictEqual(resRevoke.status, 204);

      // Verify old token is rejected
      const res2 = await request(app).get('/users/me').set('Authorization', `Bearer ${sToken}`);
      assert.strictEqual(res2.status, 401);
      assert.match(res2.body.detail, /Session revoked/i);

      // Also verify they can't access admin routes just in case
      const res3 = await request(app).get('/v1/admin/users').set('Authorization', `Bearer ${sToken}`);
      assert.strictEqual(res3.status, 401);
    });
  });
});
