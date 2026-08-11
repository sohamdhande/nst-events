import { describe, it } from 'node:test';
import assert from 'assert';
import request from 'supertest';
import { createApp } from '../../src/app';

const app = createApp();
// Register a temporary diagnostic route to echo the resolved IP
app.get('/_test_trust_proxy', (req, res) => {
  res.json({ resolved_ip: req.ip });
});

describe('Infrastructure: Trust Proxy Security', () => {
  it('correctly resolves client IP through Cloudflare + K3s NGINX chain', async () => {
    // Scenario: Client (203.0.113.1) connects to Cloudflare Edge.
    // Cloudflare connects to cloudflared (10.42.0.5).
    // cloudflared connects to NGINX ingress. NGINX appends cloudflared's IP.
    // The final header reaching Express has both the client IP and the internal pod IP.
    const headers = {
      'X-Forwarded-For': '203.0.113.1, 10.42.0.5'
    };
    
    const res = await request(app).get('/_test_trust_proxy').set(headers);
    assert.strictEqual(res.status, 200);
    // Express should strip 10.42.0.5 (trusted CIDR) and resolve 203.0.113.1
    assert.strictEqual(res.body.resolved_ip, '203.0.113.1', 'Failed to resolve the true client IP through multi-hop trusted proxies');
  });

  it('rejects spoofed X-Forwarded-For headers from direct attackers', async () => {
    // Scenario: Attacker (198.51.100.2) bypasses Cloudflare and hits an exposed K3s NodePort directly.
    // They send a spoofed header pretending to be 8.8.8.8.
    // NGINX receives the request and appends the attacker's true IP (198.51.100.2) to the end.
    const headers = {
      'X-Forwarded-For': '8.8.8.8, 198.51.100.2'
    };
    
    const res = await request(app).get('/_test_trust_proxy').set(headers);
    assert.strictEqual(res.status, 200);
    // Express evaluates from right to left. 198.51.100.2 is NOT in the trusted internal CIDRs.
    // Express stops immediately and sets the attacker's true IP as the client IP, ignoring the spoofed 8.8.8.8.
    assert.strictEqual(res.body.resolved_ip, '198.51.100.2', 'VULNERABILITY: Trust proxy accepted a spoofed IP from an untrusted source');
  });
});
