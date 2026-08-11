import { describe, it } from 'node:test';
import assert from 'node:assert';
import { generateQrPayload, verifyQrPayload } from '../../src/modules/attendance/totp.utils';

process.env.TOTP_SECRET = 'dummy_totp_secret_for_testing';

describe('TOTP Utils', () => {
  const sessionId = '123e4567-e89b-12d3-a456-426614174000';
  const qrSecret = 'test_qr_secret_12345';

  it('should generate a valid QR payload', () => {
    const payload = generateQrPayload(sessionId, qrSecret);
    assert.ok(payload.startsWith(`v1:${sessionId}:`));
    const parts = payload.split(':');
    assert.strictEqual(parts.length, 3);
    assert.strictEqual(parts[2].length, 16); // HMAC_TRUNCATION_LENGTH
  });

  it('should verify a valid QR payload', () => {
    const payload = generateQrPayload(sessionId, qrSecret);
    const isValid = verifyQrPayload(sessionId, payload, qrSecret);
    assert.strictEqual(isValid, true);
  });

  it('should reject an invalid signature', () => {
    const payload = `v1:${sessionId}:invalid_signature1`;
    const isValid = verifyQrPayload(sessionId, payload, qrSecret);
    assert.strictEqual(isValid, false);
  });

  it('should reject a malformed payload', () => {
    const payload = `v1:${sessionId}`;
    const isValid = verifyQrPayload(sessionId, payload, qrSecret);
    assert.strictEqual(isValid, false);
  });

  it('should reject a payload for a different session', () => {
    const payload = generateQrPayload(sessionId, qrSecret);
    const differentSessionId = '987e6543-e21b-34c2-a456-426614174000';
    const isValid = verifyQrPayload(differentSessionId, payload, qrSecret);
    assert.strictEqual(isValid, false);
  });
});
