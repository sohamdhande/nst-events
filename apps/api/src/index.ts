/**
 * ARCHITECTURE ENFORCEMENT NOTICE:
 * Allowed deps: @nst/database, @nst/shared only.
 * NEVER import from apps/mobile or apps/dashboard.
 */
import { createApp } from './app';

const PORT = process.env.PORT || 3001;

async function bootstrap() {
  const app = createApp();
  app.listen(PORT, () => {
    console.log(`[nst-api] Server running on port ${PORT}`);
  });
}

bootstrap().catch((err) => {
  console.error('[nst-api] Failed to start server:', err);
  process.exit(1);
});
