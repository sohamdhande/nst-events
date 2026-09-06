import { prisma, withUserContext } from '@nst/database';

export class LeaderboardService {
  async getStudentLeaderboard(query: { cursor?: string; limit: number }): Promise<{ data: any[]; nextCursor?: string }> {
    const { cursor, limit } = query;
    let offset = 0;
    if (cursor) {
      try {
        offset = parseInt(Buffer.from(cursor, 'base64').toString('ascii'), 10);
        if (isNaN(offset) || offset < 0) offset = 0;
      } catch (e) {
        offset = 0;
      }
    }

    const records = await prisma.$queryRaw<any[]>`
      WITH Ranked AS (
        SELECT 
          user_id, 
          display_name, 
          total_points, 
          attendance_points, 
          contribution_points, 
          competition_points, 
          last_refreshed_at,
          RANK() OVER (ORDER BY total_points DESC)::integer as rank
        FROM student_leaderboard_mv
      )
      SELECT * FROM Ranked
      ORDER BY total_points DESC, user_id ASC
      LIMIT ${limit + 1}::integer OFFSET ${offset}::integer
    `;

    let nextCursor: string | undefined = undefined;
    if (records.length > limit) {
      records.pop();
      nextCursor = Buffer.from((offset + limit).toString()).toString('base64');
    }

    return { data: records, nextCursor };
  }

  async getClubLeaderboard(query: { cursor?: string; limit: number }): Promise<{ data: any[]; nextCursor?: string }> {
    const { cursor, limit } = query;
    let offset = 0;
    if (cursor) {
      try {
        offset = parseInt(Buffer.from(cursor, 'base64').toString('ascii'), 10);
        if (isNaN(offset) || offset < 0) offset = 0;
      } catch (e) {
        offset = 0;
      }
    }

    const records = await prisma.$queryRaw<any[]>`
      WITH Ranked AS (
        SELECT 
          club_id, 
          club_name, 
          total_points, 
          event_count, 
          member_count, 
          last_refreshed_at,
          RANK() OVER (ORDER BY total_points DESC)::integer as rank
        FROM club_leaderboard_mv
      )
      SELECT * FROM Ranked
      ORDER BY total_points DESC, club_id ASC
      LIMIT ${limit + 1}::integer OFFSET ${offset}::integer
    `;

    let nextCursor: string | undefined = undefined;
    if (records.length > limit) {
      records.pop();
      nextCursor = Buffer.from((offset + limit).toString()).toString('base64');
    }

    return { data: records, nextCursor };
  }

  async refreshLeaderboards(): Promise<{ refreshed_at: string }> {
    await prisma.$executeRawUnsafe('REFRESH MATERIALIZED VIEW CONCURRENTLY student_leaderboard_mv');
    await prisma.$executeRawUnsafe('REFRESH MATERIALIZED VIEW CONCURRENTLY club_leaderboard_mv');
    return { refreshed_at: new Date().toISOString() };
  }

  async getClubScopedStudentLeaderboard(callerId: string, clubId: string, query: { limit: number }): Promise<{ data: any[] }> {
    return withUserContext(callerId, async (tx) => {
      const records = await tx.$queryRaw<any[]>`
        WITH Scored AS (
          SELECT 
            u.id as user_id, 
            u.full_name as display_name, 
            COALESCE(SUM(ls.points), 0)::integer as total_points
          FROM leaderboard_scores ls
          JOIN users u ON u.id = ls.user_id
          WHERE ls.club_id = ${clubId}::uuid
          GROUP BY u.id, u.full_name
        ), Ranked AS (
          SELECT *, RANK() OVER (ORDER BY total_points DESC)::integer as rank
          FROM Scored
        )
        SELECT * FROM Ranked
        ORDER BY total_points DESC, user_id ASC
        LIMIT ${query.limit}::integer
      `;

      return { data: records };
    });
  }

  async getStudentRank(userId: string): Promise<{ rank: number | null; total_points: number }> {
    const records = await prisma.$queryRaw<any[]>`
      WITH Ranked AS (
        SELECT 
          user_id, 
          total_points, 
          RANK() OVER (ORDER BY total_points DESC)::integer as rank
        FROM student_leaderboard_mv
      )
      SELECT rank, total_points FROM Ranked WHERE user_id = ${userId}::uuid
    `;

    if (records.length === 0) {
      return { rank: null, total_points: 0 };
    }

    return { rank: records[0].rank, total_points: records[0].total_points };
  }
}

export const leaderboardService = new LeaderboardService();
