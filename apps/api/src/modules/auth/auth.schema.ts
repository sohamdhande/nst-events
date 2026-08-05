import { z } from 'zod';

export const googleCallbackQuerySchema = z.object({
  code: z.string().min(1, 'Authorization code is required'),
  state: z.string().min(1, 'State parameter is required'),
});

export type GoogleCallbackQuery = z.infer<typeof googleCallbackQuerySchema>;

export const authSchemaStub = {};

