import { prisma } from '@nst/database';

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
      SELECT 
        user_id, 
        display_name, 
        total_points, 
        attendance_points, 
        contribution_points, 
        competition_points, 
        last_refreshed_at 
      FROM student_leaderboard_mv
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
      SELECT 
        club_id, 
        club_name, 
        total_points, 
        event_count, 
        member_count, 
        last_refreshed_at 
      FROM club_leaderboard_mv
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
}

export const leaderboardService = new LeaderboardService();
