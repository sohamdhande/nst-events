import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { prisma } from '../../src/lib/prisma';
import { listEvents } from '../../src/modules/events/events.service';
import { getEventRegistrations } from '../../src/modules/registrations/registrations.service';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { createApp } from '../../src/app';
import { signJwt } from '../../src/lib/jwt';

const app = createApp();

describe('Phase 14: Cursor Pagination Stability', () => {
  let userId: string;
  let clubId: string;
  const eventIds: string[] = [];

  let registrationUserId: string;
  let token: string;

  before(async () => {
    const googleSub = randomUUID();
    const user = await prisma.user.create({
      data: { email: `pagination-user-${googleSub}@test.com`, googleSub, fullName: 'Pagination Test User' },
    });
    userId = user.id;
    token = signJwt(userId);

    const googleSub2 = randomUUID();
    const user2 = await prisma.user.create({
      data: { email: `test_pagination_reg_${googleSub2}@example.com`, googleSub: googleSub2, fullName: 'Test User 2' },
    });
    registrationUserId = user2.id;

    const club = await prisma.club.create({
      data: { name: `Test Pagination Club ${randomUUID()}` },
    });
    clubId = club.id;

    const sameTime = new Date('2026-08-01T10:00:00Z');

    for (let i = 0; i < 5; i++) {
      const event = await prisma.event.create({
        data: {
          title: `Pagination Event ${i}`,
          startTime: sameTime, // identical start time for all
          endTime: new Date(sameTime.getTime() + 3600000),
          eventType: 'OTHER',
          visibility: 'PUBLIC',
          registrationType: 'INDIVIDUAL',
          attendanceType: 'SINGLE',
          createdBy: userId,
          eventClubs: { create: { clubId: club.id, isPrimary: true } }
        }
      });
      eventIds.push(event.id);
    }

    // Add 5 registrations to event 0 with identical timestamps
    for (let i = 0; i < 5; i++) {
      const tempUser = await prisma.user.create({
        data: { email: `reg_${i}@example.com`, googleSub: `sub_${i}`, fullName: `Temp ${i}` }
      });
      await prisma.eventRegistration.create({
        data: {
          eventId: eventIds[0],
          userId: tempUser.id,
          registeredAt: sameTime,
        }
      });
    }
  });

  after(async () => {
    await prisma.eventRegistration.deleteMany({ where: { eventId: eventIds[0] } });
    await prisma.user.deleteMany({ where: { email: { startsWith: 'reg_' } } });
    await prisma.eventClub.deleteMany({ where: { clubId } });
    await prisma.event.deleteMany({ where: { createdBy: userId } });
    await prisma.club.delete({ where: { id: clubId } });
    await prisma.user.delete({ where: { id: userId } });
    await prisma.user.delete({ where: { id: registrationUserId } });
  });

  it('should not skip events when cursor paginating across identical timestamps', async () => {
    const page1 = await listEvents(userId, { limit: 2, sort: 'start_time', order: 'asc', filter_club_id: clubId });
    assert.strictEqual(page1.data.length, 2);
    assert.ok(page1.pagination.has_more);
    
    const page2 = await listEvents(userId, { limit: 2, cursor: page1.pagination.next_cursor, sort: 'start_time', order: 'asc', filter_club_id: clubId });
    assert.strictEqual(page2.data.length, 2);
    assert.ok(page2.pagination.has_more);

    const page3 = await listEvents(userId, { limit: 2, cursor: page2.pagination.next_cursor, sort: 'start_time', order: 'asc', filter_club_id: clubId });
    assert.strictEqual(page3.data.length, 1);
    assert.strictEqual(page3.pagination.has_more, false);

    const allIds = [...page1.data.map((e: any) => e.id), ...page2.data.map((e: any) => e.id), ...page3.data.map((e: any) => e.id)];
    const uniqueIds = new Set(allIds);
    assert.strictEqual(uniqueIds.size, 5, 'Should have exactly 5 unique events with no duplicates');
  });

  it('should not skip registrations when cursor paginating across identical timestamps', async () => {
    const page1 = await getEventRegistrations(userId, eventIds[0], 2);
    assert.strictEqual(page1.data.length, 2);
    assert.ok(page1.pagination.has_more);
    
    const page2 = await getEventRegistrations(userId, eventIds[0], 2, page1.pagination.next_cursor as string);
    assert.strictEqual(page2.data.length, 2);
    assert.ok(page2.pagination.has_more);

    const page3 = await getEventRegistrations(userId, eventIds[0], 2, page2.pagination.next_cursor as string);
    assert.strictEqual(page3.data.length, 1);
    assert.strictEqual(page3.pagination.has_more, false);

    const allIds = [...page1.data.map((r: any) => r.id), ...page2.data.map((r: any) => r.id), ...page3.data.map((r: any) => r.id)];
    const uniqueIds = new Set(allIds);
    assert.strictEqual(uniqueIds.size, 5, 'Should have exactly 5 unique registrations with no duplicates');
  });

  describe('Phase 16A: Pagination DoS Protection', () => {
    it('GET /clubs rejects limit=999999999', async () => {
      const res = await request(app)
        .get('/clubs?limit=999999999')
        .set('Authorization', `Bearer ${token}`);
      
      assert.strictEqual(res.status, 400); // Validation error
    });

    it('GET /clubs rejects limit=abc', async () => {
      const res = await request(app)
        .get('/clubs?limit=abc')
        .set('Authorization', `Bearer ${token}`);
      
      assert.strictEqual(res.status, 400);
    });

    it('GET /clubs rejects limit=-1', async () => {
      const res = await request(app)
        .get('/clubs?limit=-1')
        .set('Authorization', `Bearer ${token}`);
      
      assert.strictEqual(res.status, 400);
    });

    it('GET /clubs accepts limit=100 and defaults to 20 if omitted', async () => {
      const resMax = await request(app)
        .get('/clubs?limit=100')
        .set('Authorization', `Bearer ${token}`);
      assert.strictEqual(resMax.status, 200);

      const resDefault = await request(app)
        .get('/clubs')
        .set('Authorization', `Bearer ${token}`);
      assert.strictEqual(resDefault.status, 200);
    });
  });
});
