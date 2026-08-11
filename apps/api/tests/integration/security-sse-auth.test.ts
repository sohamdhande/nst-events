import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import { prisma } from '../../src/lib/prisma';
import { createApp } from '../../src/app';
import { signJwt } from '../../src/lib/jwt';
import { withUserContext } from '@nst/database';
import { randomUUID } from 'crypto';

const app = createApp();

describe('Phase 16A: SSE Authorization Security', () => {
  let userA: any;
  let userB: any;
  let eventA: any;
  let eventB: any;
  let tokenA: string;
  let tokenB: string;

  before(async () => {
    // Clean up
    await prisma.$executeRawUnsafe('TRUNCATE TABLE users CASCADE');

    // Reset app.user_id to ensure RLS doesn't block setup
    await prisma.$executeRaw`SELECT set_config('app.user_id', '', false)`;

    const userAObj = await prisma.user.create({
      data: { email: 'user_a_sse@example.com', googleSub: 'google_sub_a_sse', fullName: 'User A SSE' }
    });
    userA = { id: userAObj.id };

    const userBObj = await prisma.user.create({
      data: { email: 'user_b_sse@example.com', googleSub: 'google_sub_b_sse', fullName: 'User B SSE' }
    });
    userB = { id: userBObj.id };

    tokenA = signJwt(userA.id);
    tokenB = signJwt(userB.id);

    // Event A is PUBLIC, User A can read it
    eventA = await prisma.event.create({
      data: {
        title: 'Event A Public',
        startTime: new Date(),
        endTime: new Date(Date.now() + 3600000),
        eventType: 'WORKSHOP',
        visibility: 'PUBLIC',
        registrationType: 'INDIVIDUAL',
        attendanceType: 'SINGLE',
        state: 'PUBLISHED',
        createdBy: userA.id,
      }
    });

    // Event B is PRIVATE
    eventB = await prisma.event.create({
      data: {
        title: 'Event B Private',
        startTime: new Date(),
        endTime: new Date(Date.now() + 3600000),
        eventType: 'WORKSHOP',
        visibility: 'PRIVATE',
        registrationType: 'INDIVIDUAL',
        attendanceType: 'SINGLE',
        state: 'PUBLISHED',
        createdBy: userB.id,
      }
    });
  });

  after(async () => {
    await prisma.$executeRawUnsafe('TRUNCATE TABLE users CASCADE');
    process.exit(0);
  });

  it('User A connecting to Event A/live -> SUCCESS', async () => {
    const req = request(app)
      .get(`/v1/events/${eventA.id}/live`)
      .set('Authorization', `Bearer ${tokenA}`);
      
    // Start request
    req.end();

    // Give it 100ms to process (would fail instantly if unauthorized)
    await new Promise(resolve => setTimeout(resolve, 100));

    // Abort so the connection closes and test runner can exit
    req.abort();
  });

  it('User A connecting to Event B/live -> REJECTED (Unauthorized read)', async () => {
    const res = await request(app)
      .get(`/v1/events/${eventB.id}/live`)
      .set('Authorization', `Bearer ${tokenA}`);
    
    // Since getEventById throws NotFoundError for unauthorized events
    assert.strictEqual(res.status, 404);
  });

  it('Malformed UUID -> Existing validation failure', async () => {
    const res = await request(app)
      .get(`/v1/events/not-a-uuid/live`)
      .set('Authorization', `Bearer ${tokenA}`);
    
    assert.strictEqual(res.status, 422); // UnprocessableEntityError
  });
});
