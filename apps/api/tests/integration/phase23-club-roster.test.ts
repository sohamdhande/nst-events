import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import { createApp } from '../../src/app';
import { adminPrisma } from '../helpers/adminDb';
import { signJwt } from '../../src/lib/jwt';
import { randomUUID } from 'crypto';

const app = createApp();

describe('Phase 23: Club Roster Authorization', () => {
  let mentorId = randomUUID();
  let adminId = randomUUID();
  let platformAdminId = randomUUID();
  let targetUserId = randomUUID();
  let clubId = randomUUID();

  let mentorToken: string;
  let adminToken: string;
  let platformAdminToken: string;

  before(async () => {
    // Insert test users
    await adminPrisma.$executeRaw`
      INSERT INTO users (id, email, google_sub, full_name, global_role) VALUES 
      (${mentorId}::uuid, 'mentor@test.com', 'g_sub_mentor', 'Mentor', 'STUDENT'),
      (${adminId}::uuid, 'admin@test.com', 'g_sub_admin', 'Admin', 'STUDENT'),
      (${platformAdminId}::uuid, 'platadmin@test.com', 'g_sub_plat', 'Platform Admin', 'PLATFORM_ADMIN'),
      (${targetUserId}::uuid, 'target@test.com', 'g_sub_target', 'Target User', 'STUDENT');
    `;

    // Insert club
    await adminPrisma.$executeRaw`
      INSERT INTO clubs (id, name, status) VALUES (${clubId}::uuid, 'Auth Test Club', 'ACTIVE');
    `;

    // Insert memberships
    await adminPrisma.$executeRaw`
      INSERT INTO club_memberships (id, club_id, user_id, role) VALUES 
      (gen_random_uuid(), ${clubId}::uuid, ${mentorId}::uuid, 'FACULTY_MENTOR'),
      (gen_random_uuid(), ${clubId}::uuid, ${adminId}::uuid, 'CLUB_ADMIN');
    `;

    mentorToken = signJwt(mentorId);
    adminToken = signJwt(adminId);
    platformAdminToken = signJwt(platformAdminId);
  });

  after(async () => {
    // Cleanup
    await adminPrisma.$executeRaw`DELETE FROM club_memberships WHERE club_id = ${clubId}::uuid;`;
    await adminPrisma.$executeRaw`DELETE FROM clubs WHERE id = ${clubId}::uuid;`;
    await adminPrisma.$executeRaw`DELETE FROM users WHERE id IN (${mentorId}::uuid, ${adminId}::uuid, ${platformAdminId}::uuid, ${targetUserId}::uuid);`;
  });

  it('FACULTY_MENTOR -> POST /v1/clubs/:id/members -> 403', async () => {
    const res = await request(app)
      .post(`/clubs/${clubId}/members`)
      .set('Authorization', `Bearer ${mentorToken}`)
      .send({ user_id: targetUserId, role: 'CORE_MEMBER' });
    
    assert.strictEqual(res.status, 403);
  });

  it('FACULTY_MENTOR -> DELETE /v1/clubs/:id/members/:userId -> 403', async () => {
    const res = await request(app)
      .delete(`/clubs/${clubId}/members/${targetUserId}`)
      .set('Authorization', `Bearer ${mentorToken}`);
    
    assert.strictEqual(res.status, 403);
  });

  it('CLUB_ADMIN -> POST /v1/clubs/:id/members -> 201', async () => {
    const res = await request(app)
      .post(`/clubs/${clubId}/members`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ user_id: targetUserId, role: 'CORE_MEMBER' });
    
    assert.strictEqual(res.status, 201);
  });

  it('CLUB_ADMIN -> DELETE /v1/clubs/:id/members/:userId -> 204', async () => {
    const res = await request(app)
      .delete(`/clubs/${clubId}/members/${targetUserId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    
    assert.strictEqual(res.status, 204);
  });

  it('PLATFORM_ADMIN -> POST /v1/clubs/:id/members -> 201', async () => {
    const res = await request(app)
      .post(`/clubs/${clubId}/members`)
      .set('Authorization', `Bearer ${platformAdminToken}`)
      .send({ user_id: targetUserId, role: 'CORE_MEMBER' });
    
    assert.strictEqual(res.status, 201);
  });
});
