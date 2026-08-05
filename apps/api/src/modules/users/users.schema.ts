import { z } from 'zod';

export const UpdateProfileSchema = z.object({
  body: z.object({
    full_name: z.string().min(1).optional(),
  }),
});
