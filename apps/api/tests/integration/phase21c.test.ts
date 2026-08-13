import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import { createApp } from '../../src/app';
import { prisma } from '@nst/database';
import { randomUUID } from 'crypto';

const app = createApp();

describe('Phase 21C Endpoints', () => {
  let adminUserId: string;
  let adminToken: string;

  let studentUserId: string;
  let studentToken: string;

  before(async () => {
    // Setup Admin
    adminUserId = randomUUID();
  });

  after(async () => {
    // nothing to clean up
  });

  describe('BE-001 GET /v1/dashboard/summary', () => {
    it('should return 401 if unauthenticated', async () => {
      const res = await request(app).get('/v1/dashboard/summary');
      assert.strictEqual(res.status, 401);
    });
  });

  describe('BE-005 GET /v1/admin/users', () => {
    it('should return 401 if unauthenticated', async () => {
      const res = await request(app).get('/v1/admin/users');
      assert.strictEqual(res.status, 401);
    });
  });

  describe('BE-006 POST /v1/admin/users/:id/role', () => {
    it('should return 401 if unauthenticated', async () => {
      const res = await request(app).post('/v1/admin/users/123/role').send({ role: 'STUDENT' });
      assert.strictEqual(res.status, 401);
    });
  });

  describe('BE-007 GET /v1/admin/audit-logs', () => {
    it('should return 401 if unauthenticated', async () => {
      const res = await request(app).get('/v1/admin/audit-logs');
      assert.strictEqual(res.status, 401);
    });
  });

  describe('BE-009 GET /v1/events/:id/attendance/export', () => {
    it('should return 401 if unauthenticated', async () => {
      const res = await request(app).get('/v1/events/123/attendance/export');
      assert.strictEqual(res.status, 401);
    });
  });
});
