import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { adminPrisma } from '../helpers/adminDb';
import { listEvents, getEventById, unlockEvent } from '../../src/modules/events/events.service';
import { EventType } from '@nst/database';

describe('Event Lock State Integration', () => {
  let userId: string;
  let clubId: string;
  let dbNow: Date;

  before(async () => {
    // Setup base user and club
    const user = await adminPrisma.user.create({
      data: { email: 'locktest@example.com', googleSub: 'google_locktest', fullName: 'Lock Test User' },
    });
    userId = user.id;

    const club = await adminPrisma.club.create({
      data: { name: 'Lock Test Club' },
    });
    clubId = club.id;

    await adminPrisma.clubMembership.create({
      data: { userId, clubId, role: 'CLUB_ADMIN' },
    });

    const timeResult = await adminPrisma.$queryRaw<{ now: Date }[]>`SELECT now() as now`;
    dbNow = timeResult[0].now;
  });

  after(async () => {
    // Cleanup
    await adminPrisma.eventClub.deleteMany({ where: { clubId } });
    await adminPrisma.event.deleteMany({ where: { createdBy: userId } });
    await adminPrisma.clubMembership.deleteMany({ where: { userId } });
    await adminPrisma.club.delete({ where: { id: clubId } });
    await adminPrisma.user.delete({ where: { id: userId } });
  });

  const createTestEvent = async (title: string, isLocked: boolean, endTimeDeltaHours: number) => {
    const endTime = new Date(dbNow.getTime() + endTimeDeltaHours * 3600000);
    const event = await adminPrisma.event.create({
      data: {
        title,
        description: 'Test event',
        startTime: new Date(endTime.getTime() - 3600000),
        endTime,
        eventType: EventType.WORKSHOP,
        state: 'PUBLISHED',
        isLocked,
        createdBy: userId,
      }
    });

    await adminPrisma.eventClub.create({
      data: { eventId: event.id, clubId, isPrimary: true }
    });

    return event.id;
  };

  it('CASE 1: end_time in future, is_locked = false -> UNLOCKED', async () => {
    const eventId = await createTestEvent('Case 1', false, 1);
    const event = await getEventById(userId, eventId);
    assert.strictEqual(event.lock_state, 'UNLOCKED');
    assert.strictEqual(event.isLocked, false);
  });

  it('CASE 2: end_time in future, is_locked = true -> MANUALLY_LOCKED', async () => {
    const eventId = await createTestEvent('Case 2', true, 1);
    const event = await getEventById(userId, eventId);
    assert.strictEqual(event.lock_state, 'MANUALLY_LOCKED');
    assert.strictEqual(event.isLocked, true);
  });

  it('CASE 3: event ended < 24h ago, is_locked = true -> MANUALLY_LOCKED', async () => {
    const eventId = await createTestEvent('Case 3', true, -10);
    const event = await getEventById(userId, eventId);
    assert.strictEqual(event.lock_state, 'MANUALLY_LOCKED');
  });

  it('CASE 4: event ended exactly 24h ago -> PERMANENTLY_LOCKED', async () => {
    // dbNow >= endTime + 24 hours => endTime <= dbNow - 24 hours
    // Using -24 exactly.
    const eventId = await createTestEvent('Case 4', false, -24);
    const event = await getEventById(userId, eventId);
    assert.strictEqual(event.lock_state, 'PERMANENTLY_LOCKED');
  });

  it('CASE 5: event ended > 24h ago, is_locked = false -> PERMANENTLY_LOCKED', async () => {
    const eventId = await createTestEvent('Case 5', false, -25);
    const event = await getEventById(userId, eventId);
    assert.strictEqual(event.lock_state, 'PERMANENTLY_LOCKED');
  });

  it('CASE 6: event ended > 24h ago, is_locked = true -> PERMANENTLY_LOCKED', async () => {
    const eventId = await createTestEvent('Case 6', true, -25);
    const event = await getEventById(userId, eventId);
    assert.strictEqual(event.lock_state, 'PERMANENTLY_LOCKED');
  });

  it('CASE 7: unlock before boundary -> success', async () => {
    const eventId = await createTestEvent('Case 7', true, -10);
    const res = await unlockEvent(userId, eventId);
    assert.strictEqual(res.is_locked, false);
  });

  it('CASE 8: unlock at/after boundary -> semantic lock error', async () => {
    const eventId = await createTestEvent('Case 8', true, -25);
    try {
      await unlockEvent(userId, eventId);
      assert.fail('Should have thrown an error');
    } catch (error: any) {
      assert.strictEqual(error.message, 'EVENT_LOCKED');
    }
  });

  it('listEvents and getEventById should return same lock_state for the same event', async () => {
    const eventId = await createTestEvent('Consistency', false, -25);
    const listRes = await listEvents(userId, { q: 'Consistency', limit: 10 });
    const listEvent = listRes.data.find((e: any) => e.id === eventId);
    assert.ok(listEvent, 'Event should be in list');
    
    const detailEvent = await getEventById(userId, eventId);
    
    assert.strictEqual(listEvent.lock_state, 'PERMANENTLY_LOCKED');
    assert.strictEqual(detailEvent.lock_state, 'PERMANENTLY_LOCKED');
    assert.strictEqual(listEvent.lock_state, detailEvent.lock_state);
  });
});
