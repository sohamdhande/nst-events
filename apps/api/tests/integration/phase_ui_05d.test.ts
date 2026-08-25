import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import { createApp } from '../../src/app';
import { adminPrisma } from '../helpers/adminDb';
import { signJwt } from '../../src/lib/jwt';
import { randomUUID } from 'crypto';

const app = createApp();

describe('Phase UI-05D: Event Configuration Backend Enforcement', () => {
  let userInd = randomUUID();
  let userTeam = randomUUID();
  let userTeamFull = randomUUID();
  let userSingle = randomUUID();
  let userMulti = randomUUID();
  
  let eventInd = randomUUID();
  let eventTeam = randomUUID();
  let eventTeamFull = randomUUID();
  let eventSingle = randomUUID();
  let eventMulti = randomUUID();

  let tokenInd: string;
  let tokenTeam: string;
  let tokenTeamFull: string;
  let tokenSingle: string;
  let tokenMulti: string;

  let clubId = randomUUID();

  before(async () => {
    // Insert test users
    await adminPrisma.$executeRaw`
      INSERT INTO users (id, email, google_sub, full_name, global_role) VALUES 
      (${userInd}::uuid, 'userind@test.com', 'g_sub_ind', 'User Ind', 'STUDENT'),
      (${userTeam}::uuid, 'userteam@test.com', 'g_sub_team', 'User Team', 'STUDENT'),
      (${userTeamFull}::uuid, 'userteamfull@test.com', 'g_sub_teamfull', 'User Team Full', 'STUDENT'),
      (${userSingle}::uuid, 'usersingle@test.com', 'g_sub_single', 'User Single', 'STUDENT'),
      (${userMulti}::uuid, 'usermulti@test.com', 'g_sub_multi', 'User Multi', 'STUDENT');
    `;

    await adminPrisma.$executeRaw`
      INSERT INTO clubs (id, name, status) VALUES (${clubId}::uuid, 'Test Club 05D', 'ACTIVE');
    `;
    
    // Insert events
    await adminPrisma.$executeRaw`
      INSERT INTO events (id, title, state, visibility, registration_type, attendance_type, max_capacity, created_by, start_time, end_time, event_type) VALUES 
      (${eventInd}::uuid, 'Ind Event', 'PUBLISHED', 'PUBLIC', 'INDIVIDUAL', 'SINGLE', 10, ${userInd}::uuid, now(), now() + interval '1 hour', 'WORKSHOP'),
      (${eventTeam}::uuid, 'Team Event', 'PUBLISHED', 'PUBLIC', 'TEAM', 'SINGLE', 10, ${userTeam}::uuid, now(), now() + interval '1 hour', 'HACKATHON'),
      (${eventTeamFull}::uuid, 'Team Full Event', 'PUBLISHED', 'PUBLIC', 'TEAM', 'SINGLE', 1, ${userTeamFull}::uuid, now(), now() + interval '1 hour', 'HACKATHON'),
      (${eventSingle}::uuid, 'Single Event', 'PUBLISHED', 'PUBLIC', 'INDIVIDUAL', 'SINGLE', 10, ${userSingle}::uuid, now(), now() + interval '1 hour', 'WORKSHOP'),
      (${eventMulti}::uuid, 'Multi Event', 'PUBLISHED', 'PUBLIC', 'INDIVIDUAL', 'MULTI_SESSION', 10, ${userMulti}::uuid, now(), now() + interval '1 hour', 'WORKSHOP');
    `;

    // Fill capacity for eventTeamFull
    await adminPrisma.$executeRaw`
      UPDATE events SET registration_count = 1 WHERE id = ${eventTeamFull}::uuid;
    `;
    await adminPrisma.$executeRaw`
      INSERT INTO event_registrations (id, event_id, user_id, registration_status) VALUES (gen_random_uuid(), ${eventTeamFull}::uuid, ${userSingle}::uuid, 'REGISTERED');
    `;
    
    await adminPrisma.$executeRaw`
      INSERT INTO club_memberships (id, club_id, user_id, role) VALUES 
      (gen_random_uuid(), ${clubId}::uuid, ${userSingle}::uuid, 'CLUB_ADMIN'),
      (gen_random_uuid(), ${clubId}::uuid, ${userMulti}::uuid, 'CLUB_ADMIN');
    `;

    await adminPrisma.$executeRaw`
      INSERT INTO event_clubs (event_id, club_id, is_primary) VALUES 
      (${eventSingle}::uuid, ${clubId}::uuid, true),
      (${eventMulti}::uuid, ${clubId}::uuid, true);
    `;

    tokenInd = signJwt(userInd);
    tokenTeam = signJwt(userTeam);
    tokenTeamFull = signJwt(userTeamFull);
    tokenSingle = signJwt(userSingle);
    tokenMulti = signJwt(userMulti);
  });

  after(async () => {
    // Cleanup
    await adminPrisma.$executeRaw`DELETE FROM attendance_sessions WHERE event_id IN (${eventSingle}::uuid, ${eventMulti}::uuid);`;
    await adminPrisma.$executeRaw`DELETE FROM event_registrations WHERE event_id IN (${eventInd}::uuid, ${eventTeam}::uuid, ${eventTeamFull}::uuid);`;
    await adminPrisma.$executeRaw`DELETE FROM teams WHERE event_id IN (${eventInd}::uuid, ${eventTeam}::uuid, ${eventTeamFull}::uuid);`;
    await adminPrisma.$executeRaw`DELETE FROM event_clubs WHERE event_id IN (${eventSingle}::uuid, ${eventMulti}::uuid);`;
    await adminPrisma.$executeRaw`DELETE FROM events WHERE id IN (${eventInd}::uuid, ${eventTeam}::uuid, ${eventTeamFull}::uuid, ${eventSingle}::uuid, ${eventMulti}::uuid);`;
    await adminPrisma.$executeRaw`DELETE FROM club_memberships WHERE club_id = ${clubId}::uuid;`;
    await adminPrisma.$executeRaw`DELETE FROM clubs WHERE id = ${clubId}::uuid;`;
    await adminPrisma.$executeRaw`DELETE FROM users WHERE id IN (${userInd}::uuid, ${userTeam}::uuid, ${userTeamFull}::uuid, ${userSingle}::uuid, ${userMulti}::uuid);`;
  });

  describe('Registration Enforcement', () => {
    it('INDIVIDUAL event allows individual registration', async () => {
      const res = await request(app)
        .post(`/v1/events/${eventInd}/register`)
        .set('Authorization', `Bearer ${tokenInd}`);
      
      console.log(res.body); assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.status, 'REGISTERED');
    });

    it('TEAM event rejects individual registration', async () => {
      const res = await request(app)
        .post(`/v1/events/${eventTeam}/register`)
        .set('Authorization', `Bearer ${tokenTeam}`);
      
      // PostgreSQL RAISE EXCEPTION usually maps to 400 Bad Request
      assert.strictEqual(res.status, 400);
      assert.ok(res.body.detail?.includes('Individual registration is not permitted for team events'));
    });

    it('TEAM event allows create_team when capacity available', async () => {
      const res = await request(app)
        .post(`/v1/events/${eventTeam}/teams`)
        .set('Authorization', `Bearer ${tokenTeam}`)
        .send({ team_name: 'Test Team' });
      
      console.log(res.body); assert.strictEqual(res.status, 201);
      assert.ok(res.body.team_id);
    });

    it('TEAM event allows create_team when capacity is full (FORMING state consumes 0 capacity)', async () => {
      const res = await request(app)
        .post(`/v1/events/${eventTeamFull}/teams`)
        .set('Authorization', `Bearer ${tokenTeamFull}`)
        .send({ team_name: 'Full Team' });
      
      console.log(res.body); assert.strictEqual(res.status, 201);
    });
  });

  describe('Attendance Session Enforcement', () => {
    it('SINGLE event allows first session', async () => {
      const res = await request(app)
        .post(`/v1/events/${eventSingle}/sessions`)
        .set('Authorization', `Bearer ${tokenSingle}`)
        .send({ 
          title: 'Session 1', 
          start_time: new Date().toISOString(), 
          end_time: new Date(Date.now()+10000).toISOString(),
          open_at: new Date().toISOString(),
          close_at: new Date(Date.now()+10000).toISOString(),
          geofence_radius: 50
        });
      
      if (res.status !== 201) console.error('Session 1 failed:', res.body);
      console.log(res.body); assert.strictEqual(res.status, 201);
    });

    it('SINGLE event rejects second session', async () => {
      const res = await request(app)
        .post(`/v1/events/${eventSingle}/sessions`)
        .set('Authorization', `Bearer ${tokenSingle}`)
        .send({ 
          title: 'Session 2', 
          start_time: new Date().toISOString(), 
          end_time: new Date(Date.now()+10000).toISOString(),
          open_at: new Date().toISOString(),
          close_at: new Date(Date.now()+10000).toISOString(),
          geofence_radius: 50
        });
      
      assert.strictEqual(res.status, 422);
      assert.strictEqual(res.body.detail, 'Event is configured for a single attendance session only.');
    });

    it('MULTI_SESSION event allows multiple sessions', async () => {
      const res1 = await request(app)
        .post(`/v1/events/${eventMulti}/sessions`)
        .set('Authorization', `Bearer ${tokenMulti}`)
        .send({ 
          title: 'Multi 1', 
          start_time: new Date().toISOString(), 
          end_time: new Date(Date.now()+10000).toISOString(),
          open_at: new Date().toISOString(),
          close_at: new Date(Date.now()+10000).toISOString(),
          geofence_radius: 50
        });
      
      if (res1.status !== 201) console.error('Multi Session 1 failed:', res1.body);
      assert.strictEqual(res1.status, 201);

      const res2 = await request(app)
        .post(`/v1/events/${eventMulti}/sessions`)
        .set('Authorization', `Bearer ${tokenMulti}`)
        .send({ 
          title: 'Multi 2', 
          start_time: new Date().toISOString(), 
          end_time: new Date(Date.now()+10000).toISOString(),
          open_at: new Date().toISOString(),
          close_at: new Date(Date.now()+10000).toISOString(),
          geofence_radius: 50
        });
      
      if (res2.status !== 201) console.error('Multi Session 2 failed:', res2.body);
      assert.strictEqual(res2.status, 201);
    });
  });
});
