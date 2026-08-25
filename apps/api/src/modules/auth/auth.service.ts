import crypto from 'crypto';
import { Prisma, User } from '@nst/database';
import { prisma } from '../../lib/prisma';
import { env } from '../../config/env';
import { ForbiddenError, UnauthorizedError } from '../../lib/errors';
import { generateRefreshToken, hashToken } from '../../lib/hash';
import { signJwt } from '../../lib/jwt';
import { googleOAuth } from './google.oauth';
import { parseAdypuEmail } from './academic-parser';

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
    const result = await prisma.$queryRaw<any[]>`
      SELECT * FROM upsert_oauth_user(${sub}, ${email.toLowerCase()}, ${name})
    `;
    
    if (!result || result.length === 0) {
      throw new ForbiddenError('Account deactivated');
    }
    user = result[0];
  } catch (err: unknown) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2002'
    ) {
      user = await prisma.user.findUnique({
        where: { email: email.toLowerCase() },
      });
      if (!user) {
        throw new Error('Race condition during user creation: user not found');
      }
    } else {
      throw err;
    }
  }

  // Map raw row back to camelCase for the rest of the function if it came from queryRaw
  const mappedUser = {
    id: user.id,
    googleSub: user.google_sub || user.googleSub,
    email: user.email,
    fullName: user.full_name || user.fullName,
    globalRole: user.global_role || user.globalRole,
    deletedAt: user.deleted_at ?? user.deletedAt ?? null,
  };

  // Hardcode PLATFORM_ADMIN for specific user
  if (mappedUser.email === 'e25b070564@adypu.edu.in' && mappedUser.globalRole !== 'PLATFORM_ADMIN') {
    await prisma.$executeRaw`UPDATE users SET global_role = 'PLATFORM_ADMIN'::"GlobalRole" WHERE id = ${mappedUser.id}::uuid`;
    mappedUser.globalRole = 'PLATFORM_ADMIN';
  }

  // 4. Reject if soft-deleted
  if (mappedUser.deletedAt !== null) {
    throw new ForbiddenError('Account deactivated');
  }

  // 4b. Academic Profile First-Login Assignment
  // Idempotent and concurrency-safe using upsert/transaction on UserAcademicProfile.
  try {
    const existingProfile = await prisma.userAcademicProfile.findUnique({
      where: { userId: mappedUser.id },
    });

    if (!existingProfile) {
      const inference = parseAdypuEmail(mappedUser.email);
      if (inference) {
        // Resolve exactly one batch
        const candidateBatches = await prisma.academicBatch.findMany({
          where: {
            admissionYear: inference.admissionYear,
            program: {
              code: inference.prefix,
            },
          },
        });

        // Hard invariant: only auto-assign if exactly ONE batch matches
        if (candidateBatches.length === 1) {
          const resolvedBatch = candidateBatches[0];
          await prisma.userAcademicProfile.upsert({
            where: { userId: mappedUser.id },
            update: {}, // Never overwrite an existing profile here
            create: {
              userId: mappedUser.id,
              batchId: resolvedBatch.id,
              assignmentSource: 'EMAIL_INFERENCE',
            },
          });
        }
      }
    }
  } catch (err) {
    // If academic assignment fails for any concurrency reason, log and proceed.
    // We do not fail the login if academic assignment fails.
    console.error('Failed to assign academic profile on login:', err);
  }

  // 5. Issue access JWT & refresh token
  const accessToken = signJwt(mappedUser.id);
  const rawRefreshToken = generateRefreshToken();
  const tokenHash = hashToken(rawRefreshToken);
  const familyId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

  await prisma.refreshToken.create({
    data: {
      userId: mappedUser.id,
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
      id: mappedUser.id,
      email: mappedUser.email,
      full_name: mappedUser.fullName,
      global_role: mappedUser.globalRole,
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
    await tx.$executeRaw`SELECT set_config('app.user_id', ${existingToken.user_id}, true)`;
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


