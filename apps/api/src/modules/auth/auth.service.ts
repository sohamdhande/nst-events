import crypto from 'crypto';
import { Prisma } from '@nst/database';
import { prisma } from '../../lib/prisma';
import { env } from '../../config/env';
import { ForbiddenError, UnauthorizedError } from '../../lib/errors';
import { generateRefreshToken, hashToken } from '../../lib/hash';
import { signJwt } from '../../lib/jwt';
import { googleOAuth } from './google.oauth';

export interface AuthTokenResponse {
  access_token: string;
  expires_in: number;
  user?: {
    id: string;
    email: string;
    full_name: string;
    global_role: string;
  };
  refreshToken: string;
}

export async function loginWithGoogle(
  code: string,
  ipAddress?: string,
  userAgent?: string
): Promise<AuthTokenResponse> {
  // 1. Exchange code for tokens & verify id_token
  const { id_token } = await googleOAuth.exchangeCodeForTokens(code);
  const { sub, email, name } = await googleOAuth.verifyIdToken(id_token);

  // 2. Enforce email domain restriction
  const domain = email.split('@')[1]?.toLowerCase() || '';
  const allowedDomains = env.ALLOWED_EMAIL_DOMAINS.split(',').map((d) => d.trim().toLowerCase());
  if (!allowedDomains.includes(domain)) {
    throw new ForbiddenError('Email domain not allowed');
  }

  // 3. Upsert user by googleSub with P2002 race-condition handling
  let user;
  try {
    user = await prisma.user.upsert({
      where: { googleSub: sub },
      create: {
        googleSub: sub,
        email: email.toLowerCase(),
        fullName: name,
      },
      update: {
        email: email.toLowerCase(),
        fullName: name,
      },
    });
  } catch (err: unknown) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2002'
    ) {
      user = await prisma.user.findUnique({
        where: { email: email.toLowerCase() },
      });
      if (!user) {
        throw err;
      }
    } else {
      throw err;
    }
  }

  // 4. Reject if soft-deleted
  if (user.deletedAt !== null) {
    throw new ForbiddenError('Account deactivated');
  }

  // 5. Issue access JWT & refresh token
  const accessToken = signJwt(user.id);
  const rawRefreshToken = generateRefreshToken();
  const tokenHash = hashToken(rawRefreshToken);
  const familyId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash,
      familyId,
      expiresAt,
      userAgent: userAgent || null,
      ipAddress: ipAddress || null,
    },
  });

  return {
    access_token: accessToken,
    expires_in: 900,
    user: {
      id: user.id,
      email: user.email,
      full_name: user.fullName,
      global_role: user.globalRole,
    },
    refreshToken: rawRefreshToken,
  };
}

export async function refreshTokens(
  rawRefreshToken: string,
  ipAddress?: string,
  userAgent?: string
): Promise<AuthTokenResponse> {
  if (!rawRefreshToken) {
    throw new UnauthorizedError('Missing refresh token');
  }

  const tokenHash = hashToken(rawRefreshToken);

  return prisma.$transaction(async (tx) => {
    // 1. SELECT ... FOR UPDATE on refresh_tokens row matched by token_hash
    const rows = await tx.$queryRaw<
      Array<{
        id: string;
        user_id: string;
        token_hash: string;
        family_id: string;
        expires_at: Date;
        revoked_at: Date | null;
        created_at: Date;
      }>
    >`SELECT * FROM "refresh_tokens" WHERE "token_hash" = ${tokenHash} FOR UPDATE`;

    const existingToken = rows[0];
    if (!existingToken) {
      throw new UnauthorizedError('Invalid refresh token');
    }

    const now = new Date();

    // 2. If revoked_at IS NOT NULL -> theft or race check
    if (existingToken.revoked_at !== null) {
      const deltaSeconds =
        (now.getTime() - new Date(existingToken.revoked_at).getTime()) / 1000;
      if (deltaSeconds <= 5) {
        // Benign concurrent-request race: return 401 without touching family_id
        throw new UnauthorizedError('Refresh token already used concurrently');
      } else {
        // Theft detected: revoke all rows with that family_id, return 401
        await tx.refreshToken.updateMany({
          where: {
            familyId: existingToken.family_id,
            revokedAt: null,
          },
          data: {
            revokedAt: now,
          },
        });
        throw new UnauthorizedError('Refresh token reuse detected; all sessions revoked');
      }
    }

    // 3. Reject if expired
    if (new Date(existingToken.expires_at) < now) {
      throw new UnauthorizedError('Refresh token expired');
    }

    // 4. Check user soft-delete
    const user = await tx.user.findUnique({
      where: { id: existingToken.user_id },
    });
    if (!user || user.deletedAt !== null) {
      throw new ForbiddenError('Account deactivated');
    }

    // 5. Normal rotation: revoke this row, insert child row with same family_id
    await tx.refreshToken.update({
      where: { id: existingToken.id },
      data: { revokedAt: now },
    });

    const newRawRefreshToken = generateRefreshToken();
    const newTokenHash = hashToken(newRawRefreshToken);
    const newExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await tx.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: newTokenHash,
        familyId: existingToken.family_id,
        expiresAt: newExpiresAt,
        userAgent: userAgent || null,
        ipAddress: ipAddress || null,
      },
    });

    const accessToken = signJwt(user.id);

    return {
      access_token: accessToken,
      expires_in: 900,
      refreshToken: newRawRefreshToken,
    };
  });
}

export async function logout(rawRefreshToken?: string): Promise<void> {
  if (!rawRefreshToken) {
    return;
  }
  const tokenHash = hashToken(rawRefreshToken);
  const tokenRow = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    select: { id: true, revokedAt: true },
  });
  if (tokenRow && tokenRow.revokedAt === null) {
    await prisma.refreshToken.update({
      where: { id: tokenRow.id },
      data: { revokedAt: new Date() },
    });
  }
}

export const authService = {
  loginWithGoogle,
  refreshTokens,
  logout,
};


