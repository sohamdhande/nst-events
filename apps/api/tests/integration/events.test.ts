import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { prisma } from '../../src/lib/prisma';
import { createEvent, listEvents, updateEvent } from '../../src/modules/events/events.service';
import { Prisma } from '@nst/database';

describe('Events Integration', () => {
  let userId: string;
  let clubId: string;
  let eventId: string;

  before(async () => {
    // Setup test data
    const user = await prisma.user.create({
      data: { email: 'test_events@example.com', googleSub: 'google_test_events', fullName: 'Test User' },
    });
    userId = user.id;

    const club = await prisma.club.create({
      data: { name: 'Test Events Club' },
    });
    clubId = club.id;

    await prisma.clubMembership.create({
      data: { userId, clubId, role: 'CLUB_ADMIN' },
    });
  });

  after(async () => {
    // Cleanup
    await prisma.eventClub.deleteMany({ where: { clubId } });
    await prisma.event.deleteMany({ where: { createdBy: userId } });
    await prisma.clubMembership.deleteMany({ where: { userId } });
    await prisma.club.delete({ where: { id: clubId } });
    await prisma.user.delete({ where: { id: userId } });
  });

  it('should create an event and populate search_vector', async () => {
    const event = await createEvent(userId, {
      title: 'PostgreSQL Workshop',
      description: 'Learn about PostGIS and advanced database topics',
      start_time: new Date(),
      end_time: new Date(Date.now() + 3600000),
      event_type: 'WORKSHOP',
      visibility: 'PUBLIC',
      registration_type: 'INDIVIDUAL',
      attendance_type: 'SINGLE',
      club_ids: [{ club_id: clubId, is_primary: true }],
    });

    eventId = event.id;
    assert.ok(event.id);
    assert.strictEqual(event.title, 'PostgreSQL Workshop');

    // Verify search_vector directly using raw SQL
    const result = await prisma.$queryRaw<{ search_vector: unknown }[]>`
      SELECT search_vector::text FROM events WHERE id = ${eventId}::uuid
    `;
    assert.ok(result[0].search_vector !== null, 'search_vector should not be null');
  });

  it('should return the event via listEvents full-text search', async () => {
    const searchResult = await listEvents(userId, {
      q: 'PostgreSQL',
      limit: 10,
    });
    assert.strictEqual(searchResult.data.length, 1);
    assert.strictEqual(searchResult.data[0].id, eventId);
  });

  it('should update search_vector when title changes', async () => {
    await updateEvent(userId, eventId, {
      title: 'Advanced PostGIS Workshop',
      start_time: new Date(),
      end_time: new Date(Date.now() + 3600000),
      event_type: 'WORKSHOP',
      visibility: 'PUBLIC',
      registration_type: 'INDIVIDUAL',
      attendance_type: 'SINGLE',
    });

    const searchResult = await listEvents(userId, {
      q: 'PostGIS',
      limit: 10,
    });
    assert.strictEqual(searchResult.data.length, 1);
    assert.strictEqual(searchResult.data[0].id, eventId);
    
    const oldSearchResult = await listEvents(userId, {
      q: 'PostgreSQL',
      limit: 10,
    });
    // The description still contains 'PostGIS and advanced database topics', but it no longer has PostgreSQL
    assert.strictEqual(oldSearchResult.data.length, 0);
  });
});
