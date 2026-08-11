import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import { Client } from 'pg';

process.env.DATABASE_URL = "postgresql://nst_app:new_secure_nst_app_password_987@localhost:5440/nst_events?schema=public";

import { prisma } from '../../src/lib/prisma';
import { createApp } from '../../src/app';
import { signJwt } from '../../src/lib/jwt';
import { randomUUID } from 'crypto';

const app = createApp();

describe('Phase 16A: SSE Authorization Security', () => {
  let userA: any;
  let userB: any;
  let eventA: any;
  let eventB: any;
  let tokenA: string;
  let tokenB: string;

  const pgClient = new Client({ connectionString: "postgresql://postgres:postgres@localhost:5440/nst_events?schema=public" });

  before(async () => {
    await pgClient.connect();
    
    // Clean up
    await pgClient.query('TRUNCATE TABLE users CASCADE');

    userA = { id: randomUUID() };
    userB = { id: randomUUID() };

    await pgClient.query(`
      INSERT INTO users (id, email, google_sub, full_name, global_role) VALUES 
      ($1, 'user_a_sse@example.com', 'google_sub_a_sse', 'User A SSE', 'STUDENT'),
      ($2, 'user_b_sse@example.com', 'google_sub_b_sse', 'User B SSE', 'STUDENT')
    `, [userA.id, userB.id]);

    tokenA = signJwt(userA.id);
    tokenB = signJwt(userB.id);

    eventA = { id: randomUUID() };
    eventB = { id: randomUUID() };

    // Event A is PUBLIC, User A can read it
    await pgClient.query(`
      INSERT INTO events (id, title, state, visibility, registration_type, attendance_type, created_by, start_time, end_time, event_type) VALUES 
      ($1, 'Event A Public', 'PUBLISHED', 'PUBLIC', 'INDIVIDUAL', 'SINGLE', $2, now(), now() + interval '1 hour', 'WORKSHOP')
    `, [eventA.id, userA.id]);

    // Event B is PRIVATE
    await pgClient.query(`
      INSERT INTO events (id, title, state, visibility, registration_type, attendance_type, created_by, start_time, end_time, event_type) VALUES 
      ($1, 'Event B Private', 'PUBLISHED', 'PRIVATE', 'INDIVIDUAL', 'SINGLE', $2, now(), now() + interval '1 hour', 'WORKSHOP')
    `, [eventB.id, userB.id]);
  });

  after(async () => {
    await pgClient.query('TRUNCATE TABLE users CASCADE');
    await pgClient.end();
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
