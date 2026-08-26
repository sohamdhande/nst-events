import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export interface JwtPayload {
  sub: string;
  secVer: number;
  iat?: number;
  exp?: number;
}

export function signJwt(userId: string, secVer: number = 1): string {
  return jwt.sign({ sub: userId, secVer }, env.JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: '15m',
  });
}

export function verifyJwt(token: string): JwtPayload {
  const decoded = jwt.verify(token, env.JWT_SECRET, {
    algorithms: ['HS256'],
  });
  if (
    typeof decoded === 'object' &&
    decoded !== null &&
    'sub' in decoded &&
    typeof (decoded as Record<string, unknown>).sub === 'string'
  ) {
    return {
      sub: (decoded as Record<string, unknown>).sub as string,
      secVer: (decoded as Record<string, unknown>).secVer as number,
      iat: (decoded as Record<string, unknown>).iat as number | undefined,
      exp: (decoded as Record<string, unknown>).exp as number | undefined,
    };
  }
  throw new Error('Invalid JWT payload');
}
