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

export const authRouter: Router = Router();



authRouter.get(
  '/google',
  (req: Request, res: Response, next: NextFunction): void => {
    try {
      const state = crypto.randomBytes(16).toString('hex');
      res.cookie(OAUTH_STATE_COOKIE_NAME, state, getOAuthStateCookieOptions());
      const authUrl = googleOAuth.getAuthUrl(state);
      res.redirect(authUrl);
    } catch (err) {
      next(err);
    }
  }
);

authRouter.get(
  '/google/callback',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query = googleCallbackQuerySchema.parse(req.query);
      const cookieState =
        req.signedCookies?.[OAUTH_STATE_COOKIE_NAME] ||
        req.cookies?.[OAUTH_STATE_COOKIE_NAME];
      if (!cookieState || cookieState !== query.state) {
        throw new UnauthorizedError('Invalid OAuth state parameter');
      }
      res.clearCookie(OAUTH_STATE_COOKIE_NAME, { path: '/auth' });

      const result = await authService.loginWithGoogle(
        query.code,
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
        user: result.user,
      });
    } catch (err) {
      next(err);
    }
  }
);

authRouter.post(
  '/refresh',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const rawRefreshToken =
        req.cookies?.[REFRESH_TOKEN_COOKIE_NAME] ||
        req.cookies?.refresh_token ||
        req.signedCookies?.[REFRESH_TOKEN_COOKIE_NAME] ||
        req.signedCookies?.refresh_token;
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


