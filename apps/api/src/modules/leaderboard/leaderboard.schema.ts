import { z } from 'zod';

export const getLeaderboardSchema = z.object({
  query: z.object({
    cursor: z.string().optional(),
    limit: z.coerce.number().min(1).max(100).default(20),
  }),
});
