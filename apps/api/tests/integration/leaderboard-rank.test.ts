import { describe, it, before as beforeAll, after as afterAll } from 'node:test';
import assert from 'node:assert';
import { adminPrisma as prisma } from '../helpers/adminDb';
import request from 'supertest';
import { createApp } from '../../src/app';
import { signJwt } from '../../src/lib/jwt';

const app = createApp();

describe('Leaderboard Rank & Ties', () => {
  let users: any[] = [];
  let tokens: string[] = [];
  let club: any;

  beforeAll(async () => {
    // Cleanup any lingering data from previous failed runs
    await prisma.leaderboardScore.deleteMany({
      where: { userId: { in: (await prisma.user.findMany({ where: { email: { startsWith: 'rank_test_' } } })).map(u => u.id) } }
    });
    await prisma.user.deleteMany({
      where: { email: { startsWith: 'rank_test_' } }
    });
    await prisma.club.deleteMany({
      where: { name: 'Rank Test Club' }
    });

    // 1. Create a club
    club = await prisma.club.create({
      data: { name: 'Rank Test Club', description: 'Testing ranks' }
    });

    // 2. Create 4 students with specific points to test ties
    // A: 500, B: 500, C: 400, D: 300
    // Expected Ranks: A=1, B=1, C=3, D=4
    
    for (let i = 0; i < 4; i++) {
      const user = await prisma.user.create({
        data: {
          email: `rank_test_${i}@example.com`,
          fullName: `Rank Test User ${i}`,
          globalRole: 'STUDENT',
          createdAt: new Date(),
          googleSub: `test_google_sub_${i}`,
          securityVersion: 1
        }
      });
      users.push(user);
      
      tokens.push(signJwt(user.id, 1));
    }

    // Insert points
    await prisma.leaderboardScore.createMany({
      data: [
        { userId: users[0].id, points: 500, reason: 'Win', sourceId: club.id },
        { userId: users[1].id, points: 500, reason: 'Win', sourceId: club.id },
        { userId: users[2].id, points: 400, reason: 'Participation', sourceId: club.id },
        { userId: users[3].id, points: 300, reason: 'Participation', sourceId: club.id },
      ]
    });

    // Refresh MVs
    await prisma.$executeRawUnsafe('REFRESH MATERIALIZED VIEW student_leaderboard_mv');
    await prisma.$executeRawUnsafe('REFRESH MATERIALIZED VIEW club_leaderboard_mv');
  });

  afterAll(async () => {
    // Cleanup
    await prisma.leaderboardScore.deleteMany({
      where: { userId: { in: users.map(u => u.id) } }
    });
    await prisma.user.deleteMany({
      where: { id: { in: users.map(u => u.id) } }
    });
    await prisma.club.delete({
      where: { id: club.id }
    });
  });

  it('computes correct Standard Competition Ranking with ties', async () => {
    const res = await request(app)
      .get('/v1/leaderboard/students?limit=10')
      .set('Authorization', `Bearer ${tokens[0]}`);
      
    assert.strictEqual(res.status, 200);

    const data = res.body.data;
    const u0 = data.find((d: any) => d.user_id === users[0].id);
    const u1 = data.find((d: any) => d.user_id === users[1].id);
    const u2 = data.find((d: any) => d.user_id === users[2].id);
    const u3 = data.find((d: any) => d.user_id === users[3].id);

    // Both top students should have rank 1
    assert.strictEqual(u0.rank, 1);
    assert.strictEqual(u0.total_points, 500);
    
    assert.strictEqual(u1.rank, 1);
    assert.strictEqual(u1.total_points, 500);

    // Next student should have rank 3 (skipping 2)
    assert.strictEqual(u2.rank, 3);
    assert.strictEqual(u2.total_points, 400);

    // Next student should have rank 4
    assert.strictEqual(u3.rank, 4);
    assert.strictEqual(u3.total_points, 300);
  });

  it('allows fetching personal rank directly via /me', async () => {
    // Test for User 2 (rank 3)
    const res = await request(app)
      .get('/v1/leaderboard/me')
      .set('Authorization', `Bearer ${tokens[2]}`);
      
    assert.strictEqual(res.status, 200);

    assert.strictEqual(res.body.rank, 3);
    assert.strictEqual(res.body.total_points, 400);
  });
  
  it('handles /me for unranked users', async () => {
    await prisma.user.deleteMany({
      where: { email: 'unranked@example.com' }
    });
    
    const unranked = await prisma.user.create({
      data: { email: 'unranked@example.com', fullName: 'Unranked', globalRole: 'STUDENT', googleSub: 'test_google_sub_unranked', securityVersion: 1 }
    });
    
    const unrankedToken = signJwt(unranked.id, 1);
    
    const res = await request(app)
      .get('/v1/leaderboard/me')
      .set('Authorization', `Bearer ${unrankedToken}`);
      
    assert.strictEqual(res.status, 200);

    assert.strictEqual(res.body.rank, null);
    assert.strictEqual(res.body.total_points, 0);
    
    // cleanup
    await prisma.user.delete({ where: { id: unranked.id } });
  });

});
