/**
 * ARCHITECTURE ENFORCEMENT NOTICE:
 * Allowed deps: @nst/database, @nst/shared only.
 * NEVER import from apps/api, apps/mobile, or apps/dashboard.
 */
import { startHealthServer } from './health';
import { startNotificationConsumer } from './consumers/notification.consumer';

async function main() {
  console.log('[nst-worker] Starting worker...');
  startHealthServer(3002);
  startNotificationConsumer();
}

main().catch((err) => {
  console.error('[nst-worker] Fatal error:', err);
  process.exit(1);
});
