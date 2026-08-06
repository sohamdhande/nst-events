import { z } from 'zod';
import * as dotenv from 'dotenv';

// Load .env if present (mostly for local development)
dotenv.config();

const configSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  EXPO_ACCESS_TOKEN: z.string().min(1, "EXPO_ACCESS_TOKEN is required"),
  
  WORKER_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(5000),
  WORKER_BATCH_SIZE: z.coerce.number().int().positive().default(100),
  WORKER_MAX_RETRIES: z.coerce.number().int().nonnegative().default(4),
  WORKER_SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().positive().default(25000),
  
  EXPO_RECEIPT_DELAY_MINUTES: z.coerce.number().int().positive().default(15),
  EXPO_MAX_BATCH_SIZE: z.coerce.number().int().positive().default(100),
});

const parsed = configSchema.safeParse(process.env);

import { logger, generateCorrelationId } from './lib/logger';

if (!parsed.success) {
  logger.error({ 
    correlation_id: generateCorrelationId(), 
    error: { failure_reason: 'Invalid worker configuration', stack: JSON.stringify(parsed.error.format()) } 
  }, "Invalid worker configuration");
  process.exit(1);
}

export const config = parsed.data;
