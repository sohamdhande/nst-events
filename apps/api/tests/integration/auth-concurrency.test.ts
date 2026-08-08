import test from 'node:test';
import assert from 'node:assert';
import { prisma } from '../../src/lib/prisma';
import { authService } from '../../src/modules/auth/auth.service';
import crypto from 'crypto';
import { hashToken, generateRefreshToken } from '../../src/lib/hash';

test('Refresh Token Concurrency Race', async (t) => {
  // 1. Setup mock user and refresh token
  const testUser = await prisma.user.create({
    data: {
      email: `concurrent-auth-${Date.now()}@test.com`,
      googleSub: `sub-concurrent-${Date.now()}`,
      fullName: 'Concurrent Auth User',
    }
  });

  const rawToken = generateRefreshToken();
  const tokenHash = hashToken(rawToken);
  const familyId = crypto.randomUUID();

  await prisma.refreshToken.create({
    data: {
      userId: testUser.id,
      tokenHash,
      familyId,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60),
    }
  });

  // 2. Fire 5 simultaneous refresh requests
  const attempts = 5;
  const results = await Promise.allSettled(
    Array.from({ length: attempts }).map(() => authService.refreshTokens(rawToken))
  );

  // 3. Assert exactly 1 success and 4 rejections
  const fulfilled = results.filter(r => r.status === 'fulfilled');
  const rejected = results.filter(r => r.status === 'rejected');

  assert.strictEqual(fulfilled.length, 1, 'Exactly 1 refresh request should succeed');
  assert.strictEqual(rejected.length, 4, 'Exactly 4 refresh requests should fail with benign race error');

  for (const rejection of rejected) {
    if (rejection.status === 'rejected') {
      assert.match(rejection.reason.message, /Refresh token already used concurrently/);
    }
  }

  // 4. Verify family is not globally revoked due to benign race
  const allTokens = await prisma.refreshToken.findMany({
    where: { familyId }
  });
  
  // 1 revoked (the original), 1 active (the newly issued one)
  const activeTokens = allTokens.filter(t => t.revokedAt === null);
  assert.strictEqual(activeTokens.length, 1, 'The new token family should remain active (not revoked by theft detection)');
  
  // Cleanup
  await prisma.refreshToken.deleteMany({ where: { familyId } });
  await prisma.user.delete({ where: { id: testUser.id } });
});
