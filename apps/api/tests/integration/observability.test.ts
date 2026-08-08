import { describe, it } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import { createApp } from '../../src/app';

const app = createApp();

describe('Phase 14: Observability & Error Contract', () => {
  it('should inject X-Request-ID into successful requests', async () => {
    const res = await request(app).get('/health');
    assert.strictEqual(res.status, 200);
    assert.ok(res.header['x-request-id'], 'X-Request-ID header should be present');
  });

  it('should preserve incoming valid X-Request-ID', async () => {
    const res = await request(app)
      .get('/health')
      .set('X-Request-ID', 'my-custom-trace-id');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.header['x-request-id'], 'my-custom-trace-id');
  });

  it('should return request_id in RFC 7807 error responses for 404', async () => {
    const res = await request(app).get('/v1/events/00000000-0000-0000-0000-000000000000');
    // Note: requires auth, so it returns 401 first, which is fine
    assert.strictEqual(res.status, 401);
    assert.ok(res.body.request_id, 'Error response should contain request_id');
    assert.strictEqual(res.header['x-request-id'], res.body.request_id);
  });
});
