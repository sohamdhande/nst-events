import { z } from 'zod';

export const dashboardSummaryResponseSchema = z.object({
  upcoming_events: z.array(
    z.object({
      id: z.string().uuid(),
      title: z.string(),
      start_time: z.string(),
    })
  ),
  pending_approvals: z.array(
    z.object({
      id: z.string().uuid(),
      title: z.string(),
    })
  ),
  my_clubs: z.array(
    z.object({
      id: z.string().uuid(),
      name: z.string(),
      member_count: z.number(),
    })
  ),
});

export type DashboardSummaryResponse = z.infer<typeof dashboardSummaryResponseSchema>;
