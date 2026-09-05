import crypto from 'crypto';
import { NextFunction, Request, Response, Router } from 'express';
import {
  getClearRefreshTokenCookieOptions,
  getOAuthStateCookieOptions,
  getRefreshTokenCookieOptions,
  OAUTH_STATE_COOKIE_NAME,
  REFRESH_TOKEN_COOKIE_NAME,
} from '../../lib/cookies';
import { UnauthorizedError } from '../../lib/errors';
import { googleCallbackQuerySchema } from './auth.schema';
import { authService } from './auth.service';
import { googleOAuth } from './google.oauth';
import { authenticate } from '../../middleware/authenticate';
import { prisma } from '../../lib/prisma';
import { rateLimit } from 'express-rate-limit';
import { env } from '../../config/env';
import { createMobileAuthCode, redeemMobileAuthCode } from './mobile-auth-codes';

const callbackLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many authentication attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const refreshLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60, // Much higher frequency for legitimate token refresh
  message: { error: 'Too many refresh attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const exchangeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many exchange attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const authRouter: Router = Router();



authRouter.get(
  '/google',
  (req: Request, res: Response, next: NextFunction): void => {
    try {
      const state = crypto.randomBytes(16).toString('hex');
      const platform = req.query.platform === 'mobile' ? 'mobile' : 'web';
      const statePayload = `${state}:${platform}`;
      res.cookie(OAUTH_STATE_COOKIE_NAME, statePayload, getOAuthStateCookieOptions());
      const authUrl = googleOAuth.getAuthUrl(statePayload);
      res.redirect(authUrl);
    } catch (err) {
      next(err);
    }
  }
);

authRouter.get(
  '/google/callback',
  callbackLimiter,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    let platform = 'web';
    try {
      const query = googleCallbackQuerySchema.parse(req.query);
      const cookieState =
        req.signedCookies?.[OAUTH_STATE_COOKIE_NAME] ||
        req.cookies?.[OAUTH_STATE_COOKIE_NAME];
      if (!cookieState || cookieState !== query.state) {
        throw new UnauthorizedError('Invalid OAuth state parameter');
      }
      platform = cookieState.split(':').pop() || 'web';
      res.clearCookie(OAUTH_STATE_COOKIE_NAME, { path: '/auth' });

      const result = await authService.loginWithGoogle(
        query.code,
        req.ip,
        req.headers['user-agent']
      );

      if (platform === 'mobile') {
        // Mobile: create a single-use code and redirect to the app deep link
        const mobileCode = createMobileAuthCode(result);
        res.redirect(303, `nst-events://(auth)/callback?code=${mobileCode}`);
      } else {
        // Web: existing cookie-based flow
        res.cookie(
          REFRESH_TOKEN_COOKIE_NAME,
          result.refreshToken,
          getRefreshTokenCookieOptions()
        );
        res.redirect(303, `${env.WEB_APP_URL}/dashboard`);
      }
    } catch (err: any) {
      console.error('Login Error:', err);
      if (platform === 'mobile') {
        res.redirect(303, 'nst-events://(auth)/callback?error=authentication_failed');
      } else {
        res.redirect(303, `${env.WEB_APP_URL}/login?error=authentication_failed`);
      }
    }
  }
);

authRouter.post(
  '/mobile/login-id-token',
  exchangeLimiter,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id_token } = req.body;
      if (!id_token || typeof id_token !== 'string') {
        throw new UnauthorizedError('Missing or invalid id_token');
      }

      const result = await authService.loginWithIdToken(
        id_token,
        req.ip,
        req.headers['user-agent']
      );

      res.status(200).json({
        access_token: result.access_token,
        refresh_token: result.refreshToken,
        expires_in: result.expires_in,
      });
    } catch (err) {
      next(err);
    }
  }
);

authRouter.post(
  '/mobile/exchange',
  exchangeLimiter,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { code } = req.body;
      if (!code || typeof code !== 'string') {
        throw new UnauthorizedError('Missing or invalid authorization code');
      }

      const result = redeemMobileAuthCode(code);
      if (!result) {
        throw new UnauthorizedError('Invalid, expired, or already-used authorization code');
      }

      res.status(200).json({
        access_token: result.access_token,
        refresh_token: result.refreshToken,
        expires_in: result.expires_in,
      });
    } catch (err) {
      next(err);
    }
  }
);

authRouter.post(
  '/refresh',
  refreshLimiter,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const rawRefreshToken =
        req.cookies?.[REFRESH_TOKEN_COOKIE_NAME] ||
        req.signedCookies?.[REFRESH_TOKEN_COOKIE_NAME] ||
        req.body?.refresh_token;
      if (!rawRefreshToken) {
        throw new UnauthorizedError('Missing refresh token cookie');
      }

      const result = await authService.refreshTokens(
        rawRefreshToken,
        req.ip,
        req.headers['user-agent']
      );

      res.cookie(
        REFRESH_TOKEN_COOKIE_NAME,
        result.refreshToken,
        getRefreshTokenCookieOptions()
      );

      res.status(200).json({
        access_token: result.access_token,
        expires_in: result.expires_in,
        refresh_token: result.refreshToken,
      });
    } catch (err) {
      next(err);
    }
  }
);

authRouter.post(
  '/logout',
  authenticate,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const rawRefreshToken =
        req.cookies?.[REFRESH_TOKEN_COOKIE_NAME] ||
        req.cookies?.refresh_token ||
        req.signedCookies?.[REFRESH_TOKEN_COOKIE_NAME] ||
        req.signedCookies?.refresh_token;

      await authService.logout(rawRefreshToken);

      res.clearCookie(
        REFRESH_TOKEN_COOKIE_NAME,
        getClearRefreshTokenCookieOptions()
      );
      res.status(204).json({});
    } catch (err) {
      next(err);
    }
  }
);


