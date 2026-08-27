import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { prisma } from '../../src/lib/prisma';
import { adminPrisma } from '../helpers/adminDb';

describe('SEC-01: Postgres Least-Privilege & Active RLS', () => {
  let testUserId1: string;
  let testUserId2: string;
  let testClubId: string;

  before(async () => {
    // Bootstrap data using adminPrisma (bypasses RLS)
    const user1 = await adminPrisma.user.create({
      data: {
        email: 'sec01_test1@newtonschool.co',
        fullName: 'SEC-01 Test User 1',
        globalRole: 'STUDENT',
      }
    });
    testUserId1 = user1.id;

    const user2 = await adminPrisma.user.create({
      data: {
        email: 'sec01_test2@newtonschool.co',
        fullName: 'SEC-01 Test User 2',
        globalRole: 'STUDENT',
      }
    });
    testUserId2 = user2.id;

    const club = await adminPrisma.club.create({
      data: {
        name: 'SEC-01 Security Club',
        slug: 'sec01-security-club',
      }
    });
    testClubId = club.id;
  });

  after(async () => {
    await adminPrisma.user.deleteMany({
      where: { id: { in: [testUserId1, testUserId2] } }
    });
    await adminPrisma.club.delete({
      where: { id: testClubId }
    });
  });

  it('nst_app runtime connection should not have SUPERUSER or BYPASSRLS', async () => {
    const rows = await prisma.$queryRaw<Array<{ rolsuper: boolean; rolbypasserls: boolean }>>`
      SELECT rolsuper, rolbypasserls FROM pg_roles WHERE rolname = 'nst_app'
    `;
    assert.strictEqual(rows[0].rolsuper, false, 'nst_app must not be superuser');
    assert.strictEqual(rows[0].rolbypasserls, false, 'nst_app must not bypass RLS');
  });

  it('Cross-user writes should be blocked by RLS (Connection Pool Safety)', async () => {
    // Attempt to update User 2's name while authenticated as User 1
    await assert.rejects(
      async () => {
        await prisma.$transaction(async (tx) => {
          await tx.$executeRaw`SELECT set_config('app.user_id', ${testUserId1}, true)`;
          await tx.user.update({
            where: { id: testUserId2 },
            data: { fullName: 'Hacked Name' }
          });
        });
      },
      (err: any) => {
        return err.code === 'P2025' || err.message.includes('Record to update not found');
      },
      'User 1 should not be able to update User 2 due to RLS'
    );
  });

  it('Context does not leak across transactions', async () => {
    // Transaction 1 sets context to User 1
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.user_id', ${testUserId1}, true)`;
    });

    // Transaction 2 (no context set) should have null user_id
    const rows = await prisma.$queryRaw<Array<{ current: string | null }>>`
      SELECT current_setting('app.user_id', true) as current
    `;
    assert.strictEqual(rows[0].current, null, 'app.user_id must not leak between transactions');
  });

  it('AuthorizedStudent pre-login lookup works without user context', async () => {
    // admin bootstrap
    await adminPrisma.authorizedStudent.create({
      data: {
        normalizedEmail: 'sec01prelogin@adypu.edu.in',
        status: 'ACTIVE'
      }
    });

    // Runtime fetch without context
    const student = await prisma.authorizedStudent.findUnique({
      where: { normalizedEmail: 'sec01prelogin@adypu.edu.in' }
    });
    
    assert.ok(student, 'Pre-login authorized student lookup must succeed');

    // Runtime mutation without context should fail
    await assert.rejects(
      async () => {
        await prisma.authorizedStudent.update({
          where: { normalizedEmail: 'sec01prelogin@adypu.edu.in' },
          data: { status: 'REVOKED' }
        });
      },
      (err: any) => err.code === 'P2025' || err.message.includes('Record to update not found'),
      'Mutation without context should be blocked by RLS'
    );

    await adminPrisma.authorizedStudent.delete({
      where: { normalizedEmail: 'sec01prelogin@adypu.edu.in' }
    });
  });

});
