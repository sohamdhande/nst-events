import test from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import { createApp } from '../../src/app';
import { adminPrisma } from '../helpers/adminDb';
import { getOAuthStateCookieOptions, OAUTH_STATE_COOKIE_NAME, REFRESH_TOKEN_COOKIE_NAME } from '../../src/lib/cookies';
import { env } from '../../src/config/env';
import crypto from 'crypto';
import cookieSignature from 'cookie-signature';
import { googleOAuth } from '../../src/modules/auth/google.oauth';
import sinon from 'sinon';

test('OAuth Callback Redirect Tests', async (t) => {
  const app = createApp();

  const mockState = 'test_state_123';
  // Express signed cookies require prefix 's:' + signature
  const signedStateCookie = `s:${cookieSignature.sign(mockState, env.COOKIE_SECRET)}`;

  t.afterEach(() => {
    sinon.restore();
  });

  await t.test('Successful callback establishes session and redirects to WEB_APP_URL/dashboard', async () => {
    const googleSub = `sub-redirect-${Date.now()}`;
    const testEmail = `redirect-${Date.now()}@newtonschool.co`;

    // Stub Google API verifications
    sinon.stub(googleOAuth, 'exchangeCodeForTokens').resolves({ id_token: 'mock_id_token' });
    sinon.stub(googleOAuth, 'verifyIdToken').resolves({
      sub: googleSub,
      email: testEmail,
      name: 'Redirect Test User'
    });

    const res = await request(app)
      .get(`/auth/google/callback?code=mock_auth_code&state=${mockState}`)
      .set('Cookie', `${OAUTH_STATE_COOKIE_NAME}=${signedStateCookie}`);

    assert.strictEqual(res.status, 303, 'Should return HTTP 303 See Other');
    assert.strictEqual(res.header.location, `${env.WEB_APP_URL}/dashboard`);

    // Ensure access/refresh tokens are NOT in the location
    assert.ok(!res.header.location.includes('access_token'));
    assert.ok(!res.header.location.includes('refresh_token'));
    assert.ok(!res.header.location.includes('refreshToken'));

    // Validate set-cookie headers
    const setCookies = res.header['set-cookie'] || [];
    const hasRefreshTokenCookie = setCookies.some((c: string) => c.startsWith(`${REFRESH_TOKEN_COOKIE_NAME}=`) && c.includes('HttpOnly'));
    assert.ok(hasRefreshTokenCookie, 'Should establish HttpOnly refresh token cookie');

    // Validate state cookie is cleared
    const hasClearStateCookie = setCookies.some((c: string) => c.startsWith(`${OAUTH_STATE_COOKIE_NAME}=;`) || c.includes('Max-Age=0') || c.includes('Expires=Thu, 01 Jan 1970'));
    assert.ok(hasClearStateCookie, 'Should clear the OAuth state cookie');

    // Clean up
    await adminPrisma.user.deleteMany({ where: { email: testEmail } });
  });

  await t.test('Failed callback (invalid state) redirects to WEB_APP_URL/login?error=...', async () => {
    const res = await request(app)
      .get(`/auth/google/callback?code=mock_auth_code&state=wrong_state`)
      .set('Cookie', `${OAUTH_STATE_COOKIE_NAME}=${signedStateCookie}`);

    assert.strictEqual(res.status, 303, 'Should return HTTP 303 See Other on failure');
    assert.strictEqual(res.header.location, `${env.WEB_APP_URL}/login?error=authentication_failed`);

    assert.ok(!res.header.location.includes('Invalid OAuth state parameter'), 'Should not expose raw error messages');
  });

  await t.test('Failed callback (missing Google tokens) redirects gracefully', async () => {
    // Stub Google API verifications to fail
    sinon.stub(googleOAuth, 'exchangeCodeForTokens').rejects(new Error('Google API Error'));

    const res = await request(app)
      .get(`/auth/google/callback?code=mock_auth_code&state=${mockState}`)
      .set('Cookie', `${OAUTH_STATE_COOKIE_NAME}=${signedStateCookie}`);

    assert.strictEqual(res.status, 303);
    assert.strictEqual(res.header.location, `${env.WEB_APP_URL}/login?error=authentication_failed`);
  });
});
