import test from 'node:test';
import assert from 'node:assert';

// Use a dynamic port to avoid EADDRINUSE
process.env.PORT = '0';

import { bootstrap, gracefulShutdown } from '../../src/index';

test('Graceful Shutdown Lifecycle', async (t) => {
  // Start server
  const server = await bootstrap();
  assert.ok(server.listening, 'Server should be listening');

  // Trigger shutdown (do not exit process)
  await gracefulShutdown('SIGTERM', false);

  // Verify server is closed
  assert.strictEqual(server.listening, false, 'Server should be closed after shutdown');
});
