import { describe, it } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import { createApp } from '../../src/app';

const app = createApp();

describe('Phase 16A: Rate-Limit Security (Proxy Trust)', () => {
  it('Requests from different legitimate clients -> different buckets (X-Forwarded-For)', async () => {
    // Both come from the trusted proxy (NGINX on local docker network, e.g., 10.0.0.5)
    const res1 = await request(app)
      .get('/v1/events')
      .set('X-Forwarded-For', '203.0.113.1')
      .set('X-Real-IP', '203.0.113.1');
    
    const res2 = await request(app)
      .get('/v1/events')
      .set('X-Forwarded-For', '203.0.113.2')
      .set('X-Real-IP', '203.0.113.2');

    assert.strictEqual(res1.headers['ratelimit-limit'], '100');
    assert.strictEqual(res2.headers['ratelimit-limit'], '100');
    assert.strictEqual(res1.headers['ratelimit-remaining'], '99');
    assert.strictEqual(res2.headers['ratelimit-remaining'], '99');
  });

  it('Requests from same client -> same bucket', async () => {
    const res1 = await request(app).get('/v1/events').set('X-Forwarded-For', '203.0.113.5');
    const res2 = await request(app).get('/v1/events').set('X-Forwarded-For', '203.0.113.5');
    
    const remaining1 = parseInt(res1.headers['ratelimit-remaining'] || '0', 10);
    const remaining2 = parseInt(res2.headers['ratelimit-remaining'] || '0', 10);
    
    assert.strictEqual(remaining2, remaining1 - 1);
  });

  it('Spoofed X-Forwarded-For through multiple hops drops untrusted hops', async () => {
    // If the attacker sends X-Forwarded-For: 10.1.1.1, and the proxy appends the real IP 203.0.113.6
    // The header becomes "10.1.1.1, 203.0.113.6"
    // Since trust proxy is 1, Express trusts the immediate connection (supertest) as the proxy,
    // and looks exactly 1 hop back in the X-Forwarded-For list, which is 203.0.113.6.
    // It ignores 10.1.1.1.
    const res1 = await request(app)
      .get('/v1/events')
      .set('X-Forwarded-For', '10.1.1.1, 203.0.113.6');
    
    const res2 = await request(app)
      .get('/v1/events')
      .set('X-Forwarded-For', '20.2.2.2, 203.0.113.6');
    
    const remaining1 = parseInt(res1.headers['ratelimit-remaining'] || '0', 10);
    const remaining2 = parseInt(res2.headers['ratelimit-remaining'] || '0', 10);
    
    // They should share the same bucket because the trusted IP is 203.0.113.6 for both
    assert.strictEqual(remaining2, remaining1 - 1);
  });
});
