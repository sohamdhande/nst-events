import { OAuth2Client } from 'google-auth-library';
import { env } from '../../config/env';
import { UnauthorizedError } from '../../lib/errors';

export interface VerifiedGoogleUser {
  sub: string;
  email: string;
  name: string;
}

const getOAuth2Client = () =>
  new OAuth2Client(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, env.GOOGLE_CALLBACK_URL);

export function getAuthUrl(state: string): string {
  const oauth2Client = getOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['openid', 'email', 'profile'],
    state,
    redirect_uri: env.GOOGLE_CALLBACK_URL,
  });
}

export async function exchangeCodeForTokens(code: string): Promise<{ id_token: string }> {
  const oauth2Client = getOAuth2Client();
  const { tokens } = await oauth2Client.getToken({
    code,
    redirect_uri: env.GOOGLE_CALLBACK_URL,
  });
  if (!tokens.id_token) {
    throw new UnauthorizedError('Google OAuth failed to return id_token');
  }
  return { id_token: tokens.id_token };
}

export async function verifyIdToken(idToken: string): Promise<VerifiedGoogleUser> {
  const oauth2Client = getOAuth2Client();
  const ticket = await oauth2Client.verifyIdToken({
    idToken,
    audience: env.GOOGLE_CLIENT_ID,
  });
  const payload = ticket.getPayload();
  if (!payload || !payload.sub || !payload.email) {
    throw new UnauthorizedError('Invalid Google id_token payload');
  }
  return {
    sub: payload.sub,
    email: payload.email,
    name: payload.name || payload.email.split('@')[0] || 'Unknown User',
  };
}

export const googleOAuth = {
  getAuthUrl,
  exchangeCodeForTokens,
  verifyIdToken,
};
