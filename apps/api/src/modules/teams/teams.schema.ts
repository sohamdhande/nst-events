import { z } from 'zod';

export const ParamTeamIdSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }).passthrough(),
});
