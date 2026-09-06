import { withUserContext } from '@nst/database';
import { DashboardSummaryResponse } from './dashboard.schema';

export const dashboardService = {
  async getSummary(userId: string): Promise<DashboardSummaryResponse> {
    return withUserContext(userId, async (tx) => {
      const now = new Date();

      // 1. Upcoming Events (User is registered and start_time > now)
      const upcomingRegistrations = await tx.eventRegistration.findMany({
        where: {
          userId,
          registrationStatus: 'REGISTERED',
          deletedAt: null,
          event: {
            startTime: { gt: now },
            deletedAt: null,
          },
        },
        include: {
          event: {
            select: { id: true, title: true, startTime: true },
          },
        },
        orderBy: { event: { startTime: 'asc' } },
        take: 5,
      });

      const upcoming_events = upcomingRegistrations.map((r: any) => ({
        id: r.event.id,
        title: r.event.title,
        start_time: r.event.startTime.toISOString(),
      }));

      // 2. Pending Approvals
      // Check user global role
      const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });

      let pending_approvals: { id: string; title: string }[] = [];

      if (user.globalRole === 'PLATFORM_ADMIN' || user.globalRole === 'FACULTY_ADMIN') {
        const pendingEvents = await tx.event.findMany({
          where: { state: 'PENDING_APPROVAL', deletedAt: null },
          select: { id: true, title: true },
          orderBy: { createdAt: 'asc' },
          take: 10,
        });
        pending_approvals = pendingEvents;
      } else {
        const adminClubs = await tx.clubMembership.findMany({
          where: { userId, role: { in: ['CLUB_ADMIN', 'CORE_MEMBER', 'FACULTY_MENTOR'] }, deletedAt: null },
          select: { clubId: true },
        });

        const clubIds = adminClubs.map((c: any) => c.clubId);

        if (clubIds.length > 0) {
          const pendingEvents = await tx.event.findMany({
            where: {
              state: 'PENDING_APPROVAL',
              deletedAt: null,
              eventClubs: { some: { clubId: { in: clubIds } } }
            },
            select: { id: true, title: true },
            orderBy: { createdAt: 'asc' },
            take: 10,
          });
          pending_approvals = pendingEvents;
        }
      }

      // 3. My Clubs
      const myClubsMemberships = await tx.clubMembership.findMany({
        where: { userId, deletedAt: null },
        include: {
          club: {
            select: {
              id: true,
              name: true,
              _count: {
                select: { memberships: { where: { deletedAt: null } } }
              }
            }
          }
        },
        orderBy: { club: { name: 'asc' } },
        take: 10,
      });

      const my_clubs = myClubsMemberships.map((m: any) => ({
        id: m.club.id,
        name: m.club.name,
        member_count: m.club._count.memberships,
      }));

      // 4. Points & Attendance
      const scores = await tx.leaderboardScore.aggregate({
        where: { userId },
        _sum: { points: true }
      });
      const totalPoints = scores._sum.points || 0;

      const attendedEvents = await tx.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(DISTINCT s.event_id) as count
        FROM attendance_records ar
        JOIN attendance_sessions s ON s.id = ar.session_id
        WHERE ar.user_id = ${userId}::uuid AND ar.status = 'PRESENT'
      `;
      const eventsAttendedCount = Number(attendedEvents[0]?.count || 0);

      return {
        upcoming_events,
        pending_approvals,
        my_clubs,
        totalPoints,
        eventsAttendedCount,
      };
    });
  }
};
