import { describe, it } from 'node:test';
import assert from 'node:assert';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { env } from '../../src/config/env';

// Mock env for testing
const testSecret = 'test-secret-at-least-32-chars-long-right';
env.JWT_SECRET = testSecret;

describe('Auth Utils', () => {
  const userId = '123e4567-e89b-12d3-a456-426614174000';

  it('should sign and verify a valid JWT', () => {
    const token = jwt.sign({ sub: userId }, testSecret, { expiresIn: '15m' });
    const decoded = jwt.verify(token, testSecret) as jwt.JwtPayload;
    assert.strictEqual(decoded.sub, userId);
  });

  it('should reject an expired JWT', () => {
    // Generate a token that is already expired
    const token = jwt.sign({ sub: userId, exp: Math.floor(Date.now() / 1000) - 10 }, testSecret);
    assert.throws(() => {
      jwt.verify(token, testSecret);
    }, jwt.TokenExpiredError);
  });

  it('should reject a malformed JWT', () => {
    assert.throws(() => {
      jwt.verify('not.a.jwt', testSecret);
    }, jwt.JsonWebTokenError);
  });
  
  it('should hash refresh tokens consistently', () => {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const hash1 = crypto.createHash('sha256').update(rawToken).digest('hex');
    const hash2 = crypto.createHash('sha256').update(rawToken).digest('hex');
    assert.strictEqual(hash1, hash2);
    
    const differentToken = crypto.randomBytes(32).toString('hex');
    const differentHash = crypto.createHash('sha256').update(differentToken).digest('hex');
    assert.notStrictEqual(hash1, differentHash);
  });

  // Phase D: Hostile Audit JWT attacks
  it('should reject a JWT with an invalid signature (payload tampering)', () => {
    const token = jwt.sign({ sub: userId }, testSecret, { expiresIn: '15m' });
    const parts = token.split('.');
    
    // Tamper with the payload (middle part)
    const originalPayloadStr = Buffer.from(parts[1], 'base64').toString('utf8');
    const maliciousPayload = JSON.parse(originalPayloadStr);
    maliciousPayload.sub = 'malicious-uuid-0000';
    const tamperedPayloadB64 = Buffer.from(JSON.stringify(maliciousPayload)).toString('base64').replace(/=/g, '');
    
    const tamperedToken = `${parts[0]}.${tamperedPayloadB64}.${parts[2]}`;
    
    assert.throws(() => {
      jwt.verify(tamperedToken, testSecret);
    }, jwt.JsonWebTokenError);
  });

  it('should reject the none algorithm', () => {
    // Construct a token with alg: 'none'
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64').replace(/=/g, '');
    const payload = Buffer.from(JSON.stringify({ sub: userId })).toString('base64').replace(/=/g, '');
    const maliciousToken = `${header}.${payload}.`; // Empty signature

    assert.throws(() => {
      jwt.verify(maliciousToken, testSecret);
    }, jwt.JsonWebTokenError);
  });
});
