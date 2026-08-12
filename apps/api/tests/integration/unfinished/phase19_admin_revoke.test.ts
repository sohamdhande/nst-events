import { describe, it, before, after } from 'node:test';
import { prisma } from '../../src/lib/prisma';
import { adminPrisma } from '../helpers/adminDb';
import request from 'supertest';
import assert from 'node:assert';
import app from '../../src/app';
import { signJwt } from '../../src/lib/jwt';
import { generateRefreshToken, hashToken } from '../../src/lib/hash';
import crypto from 'crypto';

describe('Phase 19 Admin Revoke Sessions', () => {
  let adminToken: string;
  let nonAdminToken: string;
  let targetUserId: string;
  let targetRawRefresh: string;

  before(async () => {
    // 1. Create a Platform Admin
    const admin = await adminPrisma.user.create({
      data: {
        email: `admin-${Date.now()}@test.com`,
        googleSub: `sub-admin-${Date.now()}`,
        fullName: 'Revoke Admin',
        globalRole: 'PLATFORM_ADMIN',
      },
    });
    adminToken = signJwt(admin.id);

    // 2. Create a non-admin
    const student = await prisma.user.create({
      data: {
        email: `student_revoke_${Date.now()}@adypu.edu.in`,
        googleSub: `google_student_${Date.now()}`,
        fullName: 'Student Non-Admin',
        globalRole: 'STUDENT',
      },
    });
    nonAdminToken = signJwt(student.id);

    // 2. Create a normal user with active refresh tokens
    const targetUser = await adminPrisma.user.create({
      data: {
        email: `target-${Date.now()}@test.com`,
        googleSub: `sub-target-${Date.now()}`,
        fullName: 'Target User',
        globalRole: 'STUDENT',
      },
    });
    targetUserId = targetUser.id;

    // 4. Create active session for target user
    targetRawRefresh = generateRefreshToken();
    await adminPrisma.refreshToken.create({
      data: {
        tokenHash: await hashToken(targetRawRefresh),
        userId: targetUser.id,
        familyId: crypto.randomBytes(16).toString('hex'),
        expiresAt: new Date(Date.now() + 86400000), // 1 day
        deviceInfo: 'test-device',
        ipAddress: '127.0.0.1',
      },
    });
  });

  it('should deny non-admin trying to revoke sessions', async () => {
    const res = await request(app)
      .post(`/v1/admin/users/${targetUserId}/revoke-sessions`)
      .set('Authorization', `Bearer ${nonAdminToken}`)
      .send();

    assert.strictEqual(res.status, 403);
  });

  it('should allow PLATFORM_ADMIN to revoke another users sessions', async () => {
    const res = await request(app)
      .post(`/v1/admin/users/${targetUserId}/revoke-sessions`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send();

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.message, 'Sessions revoked');
    assert.ok(res.body.revoked_count >= 1);

    // Verify token fails on refresh
    const refreshRes = await request(app)
      .post('/auth/refresh')
      .set('Cookie', [`refreshToken=${targetRawRefresh}`])
      .send();

    assert.strictEqual(refreshRes.status, 401);
  });
});
