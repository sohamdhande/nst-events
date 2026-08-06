import http from 'http';
import { logger } from './lib/logger';

export function startHealthServer(port = 3002) {
  const server = http.createServer((req, res) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok' }));
      return;
    }
    res.writeHead(404);
    res.end();
  });

  server.listen(port, () => {
    logger.info(`[nst-worker] Health server listening on port ${port}`);
  });

  return server;
}
