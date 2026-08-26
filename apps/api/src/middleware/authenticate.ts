import { NextFunction, Request, Response } from 'express';
import { ForbiddenError, UnauthorizedError } from '../lib/errors';
import { verifyJwt } from '../lib/jwt';
import { prisma } from '../lib/prisma';
import { withUserContext } from '@nst/database';

export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Missing or invalid Authorization header');
    }

    const token = authHeader.slice(7).trim();
    if (!token) {
      throw new UnauthorizedError('Missing or invalid Authorization header');
    }

    let payload;
    try {
      payload = verifyJwt(token);
    } catch {
      throw new UnauthorizedError('Invalid or expired access token');
    }

    const user = await withUserContext(payload.sub, async (tx) => {
      return tx.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, deletedAt: true, securityVersion: true },
      });
    });

    if (!user || user.deletedAt !== null) {
      throw new ForbiddenError('Account deactivated');
    }

    if (user.securityVersion !== payload.secVer) {
      throw new UnauthorizedError('Session revoked due to role or access change');
    }

    req.user = {
      id: user.id,
    };

    next();
  } catch (err) {
    next(err);
  }
}

export default authenticate;
