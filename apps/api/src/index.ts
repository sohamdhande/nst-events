/**
 * ARCHITECTURE ENFORCEMENT NOTICE:
 * Allowed deps: @nst/database, @nst/shared only.
 * NEVER import from apps/mobile or apps/dashboard.
 */
/// <reference path="./types/express.d.ts" />
import { createApp } from './app';
import { logger } from './lib/logger';

const PORT = process.env.PORT || 3001;

async function bootstrap() {
  const app = createApp();
  app.listen(PORT, () => {
    logger.info(`[nst-api] Server running on port ${PORT}`);
  });
}

bootstrap().catch((err) => {
  logger.error({ err }, '[nst-api] Failed to start server');
  process.exit(1);
});
