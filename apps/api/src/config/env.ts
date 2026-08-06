import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3001),
  DATABASE_URL: z.string().default('postgresql://postgres:postgres@localhost:5432/nst_events?schema=public'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters long'),
  COOKIE_SECRET: z.string().min(32, 'COOKIE_SECRET must be at least 32 characters long'),
  ATTENDANCE_QR_SECRET: z.string().min(32, 'ATTENDANCE_QR_SECRET must be at least 32 characters long'),
  GOOGLE_CLIENT_ID: z.string().default('placeholder-google-client-id'),
  GOOGLE_CLIENT_SECRET: z.string().default('placeholder-google-client-secret'),
  GOOGLE_CALLBACK_URL: z.string().url('GOOGLE_CALLBACK_URL must be a valid URL'),
  ALLOWED_EMAIL_DOMAINS: z.string().default('adypu.edu.in,newtonschool.co'),
  ALLOWED_ORIGINS: z.string().default('http://localhost:3000,http://localhost:3001'),
});

export type Env = z.infer<typeof envSchema>;

export const env = envSchema.parse(process.env);
export default env;
