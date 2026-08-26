import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../../src/app';
import { adminPrisma as prisma } from '../helpers/adminDb';
import { signJwt } from '../../src/lib/jwt';

const app = createApp();

test('PATCH /clubs/:id', async (t) => {
  let platformAdminToken: string;
  let clubAdminToken: string;
  let otherClubAdminToken: string;
  let studentToken: string;

  let platformAdminId: string;
  let clubAdminId: string;
  let otherClubAdminId: string;
  let studentId: string;

  let targetClubId: string;
  let otherClubId: string;

  t.before(async () => {
    // Clean up
    await prisma.clubMembership.deleteMany({
      where: { user: { email: { endsWith: '@example.com' } } }
    });
    await prisma.club.deleteMany({
      where: { name: { in: ['Target Club', 'Other Club'] } }
    });
    await prisma.user.deleteMany({
      where: { email: { endsWith: '@example.com' } }
    });

    // Create users
    const platformAdmin = await prisma.user.create({
      data: { email: 'platform@example.com', googleSub: 'pa_sub', globalRole: 'PLATFORM_ADMIN', fullName: 'Platform Admin' },
    });
    platformAdminId = platformAdmin.id;
    platformAdminToken = signJwt(platformAdmin.id);

    const clubAdmin = await prisma.user.create({
      data: { email: 'clubadmin@example.com', googleSub: 'ca_sub', globalRole: 'STUDENT', fullName: 'Club Admin' },
    });
    clubAdminId = clubAdmin.id;
    clubAdminToken = signJwt(clubAdmin.id);

    const otherClubAdmin = await prisma.user.create({
      data: { email: 'otherca@example.com', googleSub: 'oca_sub', globalRole: 'STUDENT', fullName: 'Other CA' },
    });
    otherClubAdminId = otherClubAdmin.id;
    otherClubAdminToken = signJwt(otherClubAdmin.id);

    const student = await prisma.user.create({
      data: { email: 'student@example.com', googleSub: 'stu_sub', globalRole: 'STUDENT', fullName: 'Student' },
    });
    studentId = student.id;
    studentToken = signJwt(student.id);

    // Create clubs
    const club1 = await prisma.club.create({
      data: { name: 'Target Club', description: 'Desc 1', bannerUrl: 'https://example.com/b1.jpg', status: 'ACTIVE' },
    });
    targetClubId = club1.id;

    const club2 = await prisma.club.create({
      data: { name: 'Other Club', description: 'Desc 2', status: 'ACTIVE' },
    });
    otherClubId = club2.id;

    // Memberships
    await prisma.clubMembership.create({
      data: { clubId: targetClubId, userId: clubAdminId, role: 'CLUB_ADMIN' },
    });
    await prisma.clubMembership.create({
      data: { clubId: otherClubId, userId: otherClubAdminId, role: 'CLUB_ADMIN' },
    });
  });

  t.after(async () => {
    await prisma.clubMembership.deleteMany({
      where: { user: { email: { endsWith: '@example.com' } } }
    });
    await prisma.club.deleteMany({
      where: { name: { in: ['Target Club', 'Other Club'] } }
    });
    await prisma.user.deleteMany({
      where: { email: { endsWith: '@example.com' } }
    });
  });

  await t.test('1. unauthenticated request → 401', async () => {
    const res = await request(app).patch(`/clubs/${targetClubId}`).send({ name: 'New Name' });
    if (res.status !== 401) {
      console.log('UNAUTH FAILED: ', res.status, res.body);
    }
    assert.strictEqual(res.status, 401);
  });

  await t.test('2. unauthorized student → 403', async () => {
    const res = await request(app)
      .patch(`/clubs/${targetClubId}`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ name: 'New Name' });
    assert.strictEqual(res.status, 403);
  });

  await t.test('4. Club Admin updating another Club → 403 / established BOLA behavior', async () => {
    const res = await request(app)
      .patch(`/clubs/${otherClubId}`)
      .set('Authorization', `Bearer ${clubAdminToken}`)
      .send({ name: 'Hacked' });
    assert.strictEqual(res.status, 403);
  });

  await t.test('13. empty payload → 400', async () => {
    const res = await request(app)
      .patch(`/clubs/${targetClubId}`)
      .set('Authorization', `Bearer ${clubAdminToken}`)
      .send({});
    assert.strictEqual(res.status, 400);
  });

  await t.test('14. unknown field → 400', async () => {
    const res = await request(app)
      .patch(`/clubs/${targetClubId}`)
      .set('Authorization', `Bearer ${clubAdminToken}`)
      .send({ unknown_field: 'hacked' });
    assert.strictEqual(res.status, 400);
  });

  await t.test('15. invalid name → validation failure', async () => {
    const res = await request(app)
      .patch(`/clubs/${targetClubId}`)
      .set('Authorization', `Bearer ${clubAdminToken}`)
      .send({ name: '' });
    assert.strictEqual(res.status, 400);
  });

  await t.test('16. unsafe banner scheme → validation failure', async () => {
    const res = await request(app)
      .patch(`/clubs/${targetClubId}`)
      .set('Authorization', `Bearer ${clubAdminToken}`)
      .send({ banner_url: 'javascript:alert(1)' });
    assert.strictEqual(res.status, 400);
  });

  await t.test('17. invalid banner URL → validation failure', async () => {
    const res = await request(app)
      .patch(`/clubs/${targetClubId}`)
      .set('Authorization', `Bearer ${clubAdminToken}`)
      .send({ banner_url: 'not-a-url' });
    assert.strictEqual(res.status, 400);
  });

  await t.test('18. duplicate name → 409', async () => {
    const res = await request(app)
      .patch(`/clubs/${targetClubId}`)
      .set('Authorization', `Bearer ${clubAdminToken}`)
      .send({ name: 'Other Club' });
    assert.strictEqual(res.status, 409);
  });

  await t.test('8. description update & 19. successful update returns canonical Club DTO', async () => {
    const res = await request(app)
      .patch(`/clubs/${targetClubId}`)
      .set('Authorization', `Bearer ${clubAdminToken}`)
      .send({ description: 'New Description' });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.description, 'New Description');
    assert.strictEqual(res.body.name, 'Target Club'); // Unchanged
    assert.strictEqual(res.body.banner_url, 'https://example.com/b1.jpg'); // Unchanged
    assert.ok(res.body.status);
    assert.ok(res.body.members);
  });

  await t.test('10. banner_url update', async () => {
    const res = await request(app)
      .patch(`/clubs/${targetClubId}`)
      .set('Authorization', `Bearer ${clubAdminToken}`)
      .send({ banner_url: 'https://example.com/b2.png' });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.banner_url, 'https://example.com/b2.png');
  });

  await t.test('9. description clear via null', async () => {
    const res = await request(app)
      .patch(`/clubs/${targetClubId}`)
      .set('Authorization', `Bearer ${clubAdminToken}`)
      .send({ description: null });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.description, null);
  });

  await t.test('11. banner_url clear via null', async () => {
    const res = await request(app)
      .patch(`/clubs/${targetClubId}`)
      .set('Authorization', `Bearer ${clubAdminToken}`)
      .send({ banner_url: null });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.banner_url, null);
  });

  await t.test('20. GET /clubs/:id reflects the update', async () => {
    const res = await request(app)
      .get(`/clubs/${targetClubId}`)
      .set('Authorization', `Bearer ${studentToken}`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.description, null);
    assert.strictEqual(res.body.banner_url, null);
  });

  await t.test('6. Platform Admin behavior according to existing authorization', async () => {
    const res = await request(app)
      .patch(`/clubs/${targetClubId}`)
      .set('Authorization', `Bearer ${platformAdminToken}`)
      .send({ name: 'Platform Updated' });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.name, 'Platform Updated');
  });

  await t.test('17.1 URL SECURITY TESTS', async () => {
    const tests = [
      { url: 'https://example.com/banner.png', status: 200 },
      { url: 'http://example.com/banner.png', status: 200 },
      { url: 'javascript:alert(1)', status: 400 },
      { url: 'data:image/png;base64,123', status: 400 },
      { url: 'file:///tmp/a.png', status: 400 },
    ];

    for (const t of tests) {
      const res = await request(app)
        .patch(`/clubs/${targetClubId}`)
        .set('Authorization', `Bearer ${platformAdminToken}`)
        .send({ banner_url: t.url });
      assert.strictEqual(res.status, t.status);
    }
  });
});
