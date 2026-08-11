import test from 'node:test';
import assert from 'node:assert';
import { prisma } from '../../src/lib/prisma';
import { adminPrisma } from '../helpers/adminDb';
import request from 'supertest';
import { createApp } from '../../src/app';
import { signJwt } from '../../src/lib/jwt';

const app = createApp();

test('Event Creation Co-Host Authorization Bypass', async (t) => {
  // 1. Setup mock users
  const attacker = await adminPrisma.user.create({
    data: { email: `attacker-${Date.now()}@test.com`, googleSub: `sub-att-${Date.now()}`, fullName: 'Attacker User', globalRole: 'STUDENT' }
  });

  const platformAdmin = await adminPrisma.user.create({
    data: { email: `admin-${Date.now()}@test.com`, googleSub: `sub-padm-${Date.now()}`, fullName: 'Platform Admin', globalRole: 'PLATFORM_ADMIN' }
  });

  const legitMultiAdmin = await adminPrisma.user.create({
    data: { email: `multi-${Date.now()}@test.com`, googleSub: `sub-multi-${Date.now()}`, fullName: 'Multi Admin', globalRole: 'STUDENT' }
  });

  // 2. Setup clubs
  const clubA = await adminPrisma.club.create({ data: { name: `Club A ${Date.now()}`, description: 'A' } });
  const clubB = await adminPrisma.club.create({ data: { name: `Club B ${Date.now()}`, description: 'B' } });

  // 3. Setup Memberships
  // Attacker is CLUB_ADMIN of Club A, but not in Club B
  await adminPrisma.clubMembership.create({ data: { userId: attacker.id, clubId: clubA.id, role: 'CLUB_ADMIN' } });

  // Legit Multi Admin is CLUB_ADMIN of Club A and CORE_MEMBER of Club B
  await adminPrisma.clubMembership.create({ data: { userId: legitMultiAdmin.id, clubId: clubA.id, role: 'CLUB_ADMIN' } });
  await adminPrisma.clubMembership.create({ data: { userId: legitMultiAdmin.id, clubId: clubB.id, role: 'CORE_MEMBER' } });

  const attackerToken = signJwt(attacker.id);
  const platformAdminToken = signJwt(platformAdmin.id);
  const legitMultiAdminToken = signJwt(legitMultiAdmin.id);

  // Helper to generate a valid future event payload
  const createPayload = (clubs: { club_id: string, is_primary: boolean }[]) => ({
    title: 'Test Event ' + Date.now(),
    start_time: new Date(Date.now() + 86400000).toISOString(),
    end_time: new Date(Date.now() + 86400000 * 2).toISOString(),
    event_type: 'WORKSHOP',
    club_ids: clubs
  });

  await t.test('Attacker tries to forcibly co-host Club B (403 Forbidden)', async () => {
    const res = await request(app)
      .post('/v1/events')
      .set('Authorization', `Bearer ${attackerToken}`)
      .send(createPayload([
        { club_id: clubA.id, is_primary: true },
        { club_id: clubB.id, is_primary: false }
      ]));

    assert.strictEqual(res.status, 403);
    assert.match(res.body.detail || '', /Insufficient club role for club/);
    
    // Verify it was atomic and didn't partially create
    const eventCount = await adminPrisma.event.count({ where: { createdBy: attacker.id } });
    assert.strictEqual(eventCount, 0);
  });

  await t.test('Attacker successfully creates single-club event for Club A (201 Created)', async () => {
    const res = await request(app)
      .post('/v1/events')
      .set('Authorization', `Bearer ${attackerToken}`)
      .send(createPayload([{ club_id: clubA.id, is_primary: true }]));

    assert.strictEqual(res.status, 201);
    const eventCount = await adminPrisma.event.count({ where: { id: res.body.id } });
    assert.strictEqual(eventCount, 1);
  });

  await t.test('Platform Admin can bypass and co-host anything without club membership (201 Created)', async () => {
    const res = await request(app)
      .post('/v1/events')
      .set('Authorization', `Bearer ${platformAdminToken}`)
      .send(createPayload([
        { club_id: clubA.id, is_primary: true },
        { club_id: clubB.id, is_primary: false }
      ]));

    assert.strictEqual(res.status, 201);
    const eventCount = await adminPrisma.event.count({ where: { id: res.body.id } });
    assert.strictEqual(eventCount, 1);
  });

  await t.test('Multi Admin can create co-hosted event because they have roles in both (201 Created)', async () => {
    const res = await request(app)
      .post('/v1/events')
      .set('Authorization', `Bearer ${legitMultiAdminToken}`)
      .send(createPayload([
        { club_id: clubA.id, is_primary: true },
        { club_id: clubB.id, is_primary: false }
      ]));

    assert.strictEqual(res.status, 201);
    const eventCount = await adminPrisma.event.count({ where: { id: res.body.id } });
    assert.strictEqual(eventCount, 1);
  });

  // Cleanup
  await adminPrisma.eventClub.deleteMany({ where: { clubId: { in: [clubA.id, clubB.id] } } });
  await adminPrisma.event.deleteMany({ where: { createdBy: { in: [attacker.id, platformAdmin.id, legitMultiAdmin.id] } } });
  await adminPrisma.clubMembership.deleteMany({ where: { userId: { in: [attacker.id, legitMultiAdmin.id] } } });
  await adminPrisma.club.deleteMany({ where: { id: { in: [clubA.id, clubB.id] } } });
  await adminPrisma.user.deleteMany({ where: { id: { in: [attacker.id, platformAdmin.id, legitMultiAdmin.id] } } });
});
