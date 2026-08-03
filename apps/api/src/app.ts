import express, { Express } from 'express';
import cors from 'cors';

export function createApp(): Express {
  const app = express();
  app.use(cors());
  app.use(express.json());

  // TODO: Mount routers in Phase 1
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  return app;
}
