import pino from 'pino';
import os from 'os';
import { randomUUID } from 'crypto';

const isDev = process.env.NODE_ENV !== 'production';

// Canonical Log Schema
export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => {
      return { level: label.toUpperCase() };
    },
  },
  base: {
    worker_instance: os.hostname(),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  transport: isDev
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
        },
      }
    : undefined,
});

export function generateCorrelationId() {
  return randomUUID();
}
