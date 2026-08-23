import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import { createApp } from '../../src/app';
import { adminPrisma } from '../helpers/adminDb';
import { signJwt } from '../../src/lib/jwt';
import { randomUUID } from 'crypto';

const app = createApp();

describe('Phase 23: Registration Contract', () => {
  let userId1 = randomUUID();
  let userId2 = randomUUID();
  let userId3 = randomUUID();
  let eventId = randomUUID();

  let token1: string;
  let token2: string;
  let token3: string;

  before(async () => {
    // Insert test users
    await adminPrisma.$executeRaw`
      INSERT INTO users (id, email, google_sub, full_name, global_role) VALUES 
      (${userId1}::uuid, 'user1_reg@test.com', 'g_sub_reg1', 'User 1', 'STUDENT'),
      (${userId2}::uuid, 'user2_reg@test.com', 'g_sub_reg2', 'User 2', 'STUDENT'),
      (${userId3}::uuid, 'user3_reg@test.com', 'g_sub_reg3', 'User 3', 'STUDENT');
    `;

    // Insert event
    await adminPrisma.$executeRaw`
      INSERT INTO events (id, title, state, visibility, registration_type, attendance_type, created_by, start_time, end_time, event_type) VALUES 
      (${eventId}::uuid, 'Registration Test Event', 'PUBLISHED', 'PUBLIC', 'INDIVIDUAL', 'SINGLE', ${userId1}::uuid, now(), now() + interval '1 hour', 'WORKSHOP');
    `;

    // Insert registrations
    await adminPrisma.$executeRaw`
      INSERT INTO event_registrations (id, event_id, user_id, registration_status) VALUES 
      (gen_random_uuid(), ${eventId}::uuid, ${userId1}::uuid, 'REGISTERED'),
      (gen_random_uuid(), ${eventId}::uuid, ${userId2}::uuid, 'WAITLISTED');
    `;

    token1 = signJwt(userId1);
    token2 = signJwt(userId2);
    token3 = signJwt(userId3);
  });

  after(async () => {
    // Cleanup
    await adminPrisma.$executeRaw`DELETE FROM event_registrations WHERE event_id = ${eventId}::uuid;`;
    await adminPrisma.$executeRaw`DELETE FROM events WHERE id = ${eventId}::uuid;`;
    await adminPrisma.$executeRaw`DELETE FROM users WHERE id IN (${userId1}::uuid, ${userId2}::uuid, ${userId3}::uuid);`;
  });

  it('no registration -> 200 response -> { status: "NOT_REGISTERED" }', async () => {
    const res = await request(app)
      .get(`/v1/events/${eventId}/my-registration`)
      .set('Authorization', `Bearer ${token3}`);
    
    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(res.body, { status: 'NOT_REGISTERED' });
  });

  it('REGISTERED status is preserved', async () => {
    const res = await request(app)
      .get(`/v1/events/${eventId}/my-registration`)
      .set('Authorization', `Bearer ${token1}`);
    
    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(res.body, { status: 'REGISTERED' });
  });

  it('WAITLISTED status is preserved', async () => {
    const res = await request(app)
      .get(`/v1/events/${eventId}/my-registration`)
      .set('Authorization', `Bearer ${token2}`);
    
    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(res.body, { status: 'WAITLISTED' });
  });
});
