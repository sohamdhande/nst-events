import { describe, it } from 'node:test';
import assert from 'node:assert';
import { generateQrPayload, verifyQrPayload, TOTP_WINDOW_SECONDS } from '../../src/modules/attendance/totp.utils';
import crypto from 'crypto';

process.env.TOTP_SECRET = 'dummy_totp_secret_for_testing';

describe('TOTP Utils (30s Window)', () => {
  const sessionId = '123e4567-e89b-12d3-a456-426614174000';
  const qrSecret = 'test_qr_secret_12345';

  it('1. Token generated in current 30s epoch -> accepted', () => {
    const payload = generateQrPayload(sessionId, qrSecret);
    const isValid = verifyQrPayload(sessionId, payload, qrSecret);
    assert.strictEqual(isValid, true);
  });

  it('2. Previous epoch within allowed drift -> accepted', () => {
    const nowMs = Date.now();
    // Simulate token generated 30 seconds ago (previous epoch)
    const pastMs = nowMs - (TOTP_WINDOW_SECONDS * 1000);
    
    // Generate payload manually using the past epoch
    const pastEpoch = Math.floor(pastMs / (TOTP_WINDOW_SECONDS * 1000));
    const hmacInput = `v1:${sessionId}:${pastEpoch}`;
    const hmac = crypto.createHmac('sha256', qrSecret);
    hmac.update(hmacInput);
    const signature = hmac.digest('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '').substring(0, 16);
    const pastPayload = `v1:${sessionId}:${signature}`;
    
    const isValid = verifyQrPayload(sessionId, pastPayload, qrSecret, nowMs);
    assert.strictEqual(isValid, true);
  });

  it('3. Token outside ±1 epoch -> QR_EXPIRED (rejected)', () => {
    const nowMs = Date.now();
    // Simulate token generated 61 seconds ago (2 epochs ago)
    const farPastMs = nowMs - ((TOTP_WINDOW_SECONDS * 2) * 1000) - 1000;
    
    // Generate payload manually using the far past epoch
    const pastEpoch = Math.floor(farPastMs / (TOTP_WINDOW_SECONDS * 1000));
    const hmacInput = `v1:${sessionId}:${pastEpoch}`;
    const hmac = crypto.createHmac('sha256', qrSecret);
    hmac.update(hmacInput);
    const signature = hmac.digest('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '').substring(0, 16);
    const pastPayload = `v1:${sessionId}:${signature}`;
    
    const isValid = verifyQrPayload(sessionId, pastPayload, qrSecret, nowMs);
    assert.strictEqual(isValid, false);
  });

  it('4. 30-second admin refresh lifecycle does not display an already-invalid token', () => {
    // A token displayed for exactly 30 seconds should still be valid at the very end
    // of its display lifecycle, because 30 seconds is exactly 1 epoch drift.
    const nowMs = Date.now();
    const tokenDisplayStartMs = nowMs - 29999; // Displayed 29.999 seconds ago
    
    const pastEpoch = Math.floor(tokenDisplayStartMs / (TOTP_WINDOW_SECONDS * 1000));
    const hmacInput = `v1:${sessionId}:${pastEpoch}`;
    const hmac = crypto.createHmac('sha256', qrSecret);
    hmac.update(hmacInput);
    const signature = hmac.digest('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '').substring(0, 16);
    const pastPayload = `v1:${sessionId}:${signature}`;
    
    const isValid = verifyQrPayload(sessionId, pastPayload, qrSecret, nowMs);
    assert.strictEqual(isValid, true);
  });

  it('5. Existing QR payload format remains unchanged', () => {
    const payload = generateQrPayload(sessionId, qrSecret);
    assert.ok(payload.startsWith(`v1:${sessionId}:`));
    const parts = payload.split(':');
    assert.strictEqual(parts.length, 3);
    assert.strictEqual(parts[2].length, 16); // HMAC_TRUNCATION_LENGTH
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
