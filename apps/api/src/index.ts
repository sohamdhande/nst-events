/**
 * ARCHITECTURE ENFORCEMENT NOTICE:
 * Allowed deps: @nst/database, @nst/shared only.
 * NEVER import from apps/mobile or apps/dashboard.
 */
/// <reference path="./types/express.d.ts" />
import { createApp } from './app';
import { logger } from './lib/logger';

import { Server } from 'http';
import { prisma } from './lib/prisma';
import { pgListener } from './modules/sse/pg-listener';

const PORT = process.env.PORT || 3001;

let server: Server | null = null;
let isShuttingDown = false;

export async function bootstrap(): Promise<Server> {
  await prisma.$connect();
  logger.info('[nst-api] Database connected successfully');

  pgListener.connect().catch((err) => {
    logger.error({ err }, '[nst-api] Failed to initialize Postgres SSE listener bridge');
  });

  const app = createApp();
  return new Promise((resolve) => {
    server = app.listen(PORT, () => {
      logger.info(`[nst-api] Server running on port ${PORT}`);
      resolve(server!);
    });
  });
}

export async function gracefulShutdown(signal: string, shouldExit = true) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  logger.info(`[nst-api] Received ${signal}, starting graceful shutdown...`);

  const timeout = setTimeout(() => {
    logger.error('[nst-api] Shutdown timed out. Forcing exit.');
    if (shouldExit) process.exit(1);
  }, 10000);

  try {
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server!.close((err) => (err ? reject(err) : resolve()));
      });
      logger.info('[nst-api] HTTP server closed');
    }

    await pgListener.disconnect();
    logger.info('[nst-api] PG listener disconnected');

    await prisma.$disconnect();
    logger.info('[nst-api] Prisma disconnected');

    clearTimeout(timeout);
    logger.info('[nst-api] Graceful shutdown completed cleanly');
    if (shouldExit) process.exit(0);
  } catch (err) {
    logger.error({ err }, '[nst-api] Error during graceful shutdown');
    clearTimeout(timeout);
    if (shouldExit) process.exit(1);
  }
}

// Only start automatically if this file is run directly (not imported in tests)
if (require.main === module) {
  bootstrap().catch((err) => {
    logger.error({ err }, '[nst-api] Failed to start server');
    process.exit(1);
  });

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}
