import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import crypto from 'crypto';
import {
  createMobileAuthCode,
  redeemMobileAuthCode,
} from '../../src/modules/auth/mobile-auth-codes';
import { AuthTokenResponse } from '../../src/modules/auth/auth.service';

function makeFakeAuthResult(): AuthTokenResponse {
  return {
    access_token: `at_${crypto.randomBytes(16).toString('hex')}`,
    expires_in: 900,
    refreshToken: `rt_${crypto.randomBytes(16).toString('hex')}`,
  };
}

describe('Mobile Auth Codes', () => {
  it('should create and redeem a valid code', () => {
    const result = makeFakeAuthResult();
    const code = createMobileAuthCode(result);

    assert.strictEqual(typeof code, 'string');
    assert.strictEqual(code.length, 64); // 32 bytes = 64 hex chars

    const redeemed = redeemMobileAuthCode(code);
    assert.ok(redeemed, 'Redeemed result should not be null');
    assert.strictEqual(redeemed!.access_token, result.access_token);
    assert.strictEqual(redeemed!.refreshToken, result.refreshToken);
    assert.strictEqual(redeemed!.expires_in, result.expires_in);
  });

  it('should reject a code on second use (single-use)', () => {
    const result = makeFakeAuthResult();
    const code = createMobileAuthCode(result);

    // First use succeeds
    const first = redeemMobileAuthCode(code);
    assert.ok(first, 'First redemption should succeed');

    // Second use fails
    const second = redeemMobileAuthCode(code);
    assert.strictEqual(second, null, 'Second redemption should return null');
  });

  it('should reject an unknown code', () => {
    const unknownCode = crypto.randomBytes(32).toString('hex');
    const result = redeemMobileAuthCode(unknownCode);
    assert.strictEqual(result, null, 'Unknown code should return null');
  });

  it('should reject an empty string code', () => {
    const result = redeemMobileAuthCode('');
    assert.strictEqual(result, null, 'Empty code should return null');
  });

  it('should create unique codes for the same auth result', () => {
    const result = makeFakeAuthResult();
    const code1 = createMobileAuthCode(result);
    const code2 = createMobileAuthCode(result);
    assert.notStrictEqual(code1, code2, 'Each code should be unique');
  });
});
