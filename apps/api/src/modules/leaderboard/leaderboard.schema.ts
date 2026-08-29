import { z } from 'zod';

export const getLeaderboardSchema = z.object({
  query: z.object({
    cursor: z.string().optional(),
    limit: z.coerce.number().min(1).max(100).default(20),
  }),
});

export const getClubLeaderboardSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  query: z.object({
    limit: z.coerce.number().min(1).max(100).default(50),
  }),
});
