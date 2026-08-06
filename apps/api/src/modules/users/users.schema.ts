import { z } from 'zod';

export const UpdateProfileSchema = z.object({
  body: z.object({
    full_name: z.string().min(1).optional(),
  }),
});

export const RegisterPushTokenSchema = z.object({
  body: z.object({
    device_id: z.string().min(1),
    expo_token: z.string().min(1),
    platform: z.string().min(1),
  }),
});
