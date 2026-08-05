import { CookieOptions } from 'express';
import { env } from '../config/env';

export const REFRESH_TOKEN_COOKIE_NAME = 'refreshToken';
export const OAUTH_STATE_COOKIE_NAME = 'oauth_state';

export function getRefreshTokenCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/auth',
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  };
}

export function getClearRefreshTokenCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/auth',
  };
}

export function getOAuthStateCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/auth',
    maxAge: 10 * 60 * 1000, // 10 minutes
    signed: true,
  };
}
