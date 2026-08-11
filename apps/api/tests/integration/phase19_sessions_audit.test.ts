import { describe, it, before, after } from 'node:test';
import { prisma } from '../../src/lib/prisma';
import { adminPrisma } from '../helpers/adminDb';
import request from 'supertest';
import assert from 'node:assert';
import app from '../../src/app';
import { signJwt } from '../../src/lib/jwt';
import { getRefreshTokenCookieOptions } from '../../src/lib/cookies';
import { generateRefreshToken, hashToken } from '../../src/lib/hash';
import crypto from 'crypto';

describe('Phase 19 Audit Trail: AttendanceSession createdBy', () => {
  let adminUserId: string;
  let adminToken: string;
  let eventId: string;

  before(async () => {
    // 1. Create a Platform Admin user
    const admin = await adminPrisma.user.create({
      data: {
        email: `admin-${Date.now()}@test.com`,
        googleSub: `sub-admin-${Date.now()}`,
        fullName: 'Audit Admin',
        globalRole: 'PLATFORM_ADMIN',
      },
    });
    adminUserId = admin.id;

    const rawRefresh = generateRefreshToken();
    const tokenHash = hashToken(rawRefresh);
    await prisma.refreshToken.create({
      data: {
        userId: adminUserId,
        tokenHash,
        familyId: crypto.randomUUID(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    adminToken = signJwt(adminUserId);

    // 2. Create an event
    const club = await prisma.club.create({
      data: {
        name: `Audit Club ${Date.now()}`,
        description: 'For audit test',
      },
    });

    const event = await adminPrisma.event.create({
      data: {
        title: 'Audit Test Event',
        startTime: new Date(Date.now() - 3600000),
        endTime: new Date(Date.now() + 3600000),
        eventType: 'GUEST_LECTURE',
        createdBy: adminUserId,
        state: 'PUBLISHED',
        eventClubs: {
          create: [{ clubId: club.id, isPrimary: true }],
        },
      },
    });
    eventId = event.id;
  });

  after(async () => {
    // Cleanup is handled globally by setup.ts if needed, or we can leave it
  });

  it('should populate createdBy on attendance session creation', async () => {
    const payload = {
      title: 'Audit Session',
      start_time: new Date(Date.now() + 86400000).toISOString(),
      end_time: new Date(Date.now() + 86400000 * 2).toISOString(),
      open_at: new Date(Date.now() + 86400000).toISOString(),
      close_at: new Date(Date.now() + 86400000 * 2).toISOString(),
    };

    const res = await request(app)
      .post(`/v1/events/${eventId}/sessions`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send(payload);

    assert.strictEqual(res.status, 201);
    assert.ok(res.body.data.id);

    // 2. Fetch the session directly from DB as a superuser to check createdBy
    const sessions = await adminPrisma.$queryRaw<any[]>`SELECT id, created_by FROM attendance_sessions WHERE id = ${res.body.data.id}::uuid`;
    const session = sessions[0];

    assert.ok(session);
    assert.strictEqual(session.created_by, adminUserId); // Crucial audit trail assertion
  });
});
