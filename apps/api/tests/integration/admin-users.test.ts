import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../../src/app';
import { adminPrisma as prisma } from '../helpers/adminDb';
import { signJwt } from '../../src/lib/jwt';

describe('Admin Users API', () => {
  let adminToken: string;
  let testUsers: any[] = [];
  let adminId: string;
  let app: any;

  before(async () => {
    app = createApp();
    const admin = await prisma.user.create({ data: { email: 'test_admin_auth@example.com', globalRole: 'PLATFORM_ADMIN', fullName: 'Test', googleSub: 'auth' } });
    adminId = admin.id;
    adminToken = signJwt(admin.id);

    // Create 5 users as described
    const u1 = await prisma.user.create({ data: { email: 'student_no_admin@example.com', globalRole: 'STUDENT', fullName: 'Student', googleSub: 's1' } });
    
    const club = await prisma.club.create({ data: { name: 'Test Club Admin' } });
    const u2 = await prisma.user.create({ data: { email: 'student_admin@example.com', globalRole: 'STUDENT', fullName: 'Student 2', googleSub: 's2', clubMemberships: { create: { clubId: club.id, role: 'CLUB_ADMIN' } } } });
    
    const u3 = await prisma.user.create({ data: { email: 'mentor@example.com', globalRole: 'FACULTY_MENTOR', fullName: 'Mentor', googleSub: 's3' } });
    const u4 = await prisma.user.create({ data: { email: 'fac_admin@example.com', globalRole: 'FACULTY_ADMIN', fullName: 'Fac Admin', googleSub: 's4' } });
    const u5 = await prisma.user.create({ data: { email: 'plat_admin@example.com', globalRole: 'PLATFORM_ADMIN', fullName: 'Plat Admin', googleSub: 's5' } });

    testUsers = [u1, u2, u3, u4, u5];
  });

  after(async () => {
    await prisma.clubMembership.deleteMany();
    await prisma.club.deleteMany({ where: { name: 'Test Club Admin' } });
    await prisma.user.deleteMany({ where: { id: { in: [...testUsers.map(u => u.id), adminId] } } });
  });

  it('scope=administrators filters correctly', async () => {
    const res = await request(app).get('/v1/admin/users?scope=administrators').set('Authorization', `Bearer ${adminToken}`);
    assert.equal(res.status, 200);
    
    const emails = res.body.data.map((u: any) => u.email);
    assert.ok(!emails.includes('student_no_admin@example.com'));
    assert.ok(emails.includes('student_admin@example.com'));
    assert.ok(emails.includes('mentor@example.com'));
    assert.ok(emails.includes('fac_admin@example.com'));
    assert.ok(emails.includes('plat_admin@example.com'));
  });
});
