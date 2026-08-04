// ============================================================
// NST Events — Database Schema & Integration Verification Test
// ============================================================

import assert from 'node:assert';
import { test } from 'node:test';
import { PrismaClient, GlobalRole, ClubRole, ClubStatus, EventState } from '@prisma/client';

process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/nst_events';

const prisma = new PrismaClient();

test('Database Connection & Schema Contract Verification', async (t) => {
  await t.test('Prisma Client can instantiate and query database', async () => {
    const userCount = await prisma.user.count();
    assert.ok(userCount >= 0, 'User count should be non-negative');
  });

  await t.test('Enums exist and match canonical definitions', () => {
    assert.strictEqual(GlobalRole.STUDENT, 'STUDENT');
    assert.strictEqual(GlobalRole.FACULTY_ADMIN, 'FACULTY_ADMIN');
    assert.strictEqual(GlobalRole.PLATFORM_ADMIN, 'PLATFORM_ADMIN');

    assert.strictEqual(ClubRole.MEMBER, 'MEMBER');
    assert.strictEqual(ClubRole.CORE_MEMBER, 'CORE_MEMBER');
    assert.strictEqual(ClubRole.CLUB_ADMIN, 'CLUB_ADMIN');
    assert.strictEqual(ClubRole.FACULTY_MENTOR, 'FACULTY_MENTOR');

    assert.notStrictEqual(
      GlobalRole.STUDENT as unknown,
      ClubRole.MEMBER as unknown,
      'GlobalRole and ClubRole must remain separate enums'
    );
  });

  await t.test('Seed record integrity (if database is seeded)', async () => {
    const clubs = await prisma.club.findMany();
    if (clubs.length > 0) {
      assert.ok(clubs.some((c) => c.status === ClubStatus.ACTIVE), 'Should have active clubs in seed');
    }
  });

  t.after(async () => {
    await prisma.$disconnect();
  });
});
