import express, { Express } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { env } from './config/env';
import rateLimit from 'express-rate-limit';
import { prisma } from './lib/prisma';
import { authRouter } from './modules/auth/auth.router';
import { usersRouter } from './modules/users/users.router';
import { clubsRouter } from './modules/clubs/clubs.router';
import { eventsRouter } from './modules/events/events.router';
import { attendanceRouter } from './modules/attendance/attendance.router';
import { leaderboardRouter, adminLeaderboardRouter } from './modules/leaderboard/leaderboard.router';
import { notificationsRouter } from './modules/notifications/notifications.router';
import { adminQueueRouter } from './modules/admin/queue.router';
import { adminUsersRouter } from './modules/admin/users.router';
import { teamsRouter } from './modules/teams/teams.router';
import { registrationsRouter } from './modules/registrations/registrations.router';
import { errorHandler } from './middleware/error-handler';
import { requestIdMiddleware } from './middleware/request-id';
import { requestLogger } from './middleware/request-logger';
import { sseRouter } from './modules/sse/sse.router';
import { pgListener } from './modules/sse/pg-listener';


export function createApp(): Express {
  const app = express();
  
  // SECURITY [TRUST PROXY]: Trust internal K3s cluster overlay networks (cloudflared tunnels, NGINX ingress).
  // This explicitly prevents IP spoofing in our multi-hop Cloudflare -> K3s topology.
  // Express will strip these trusted internal IPs from X-Forwarded-For right-to-left
  // to resolve the true public client IP.
  // Do NOT simplify this to `trust proxy: 1` or `trust proxy: true`, as that will
  // either rate-limit Cloudflare's own IPs or allow attackers to spoof client IPs.
  app.set('trust proxy', ['loopback', 'linklocal', 'uniquelocal', '10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16']);
  
  app.use(helmet());
  app.use(
    cors({
      origin: env.ALLOWED_ORIGINS.split(',').map((o) => o.trim()),
      credentials: true,
    })
  );
  app.use(express.json());
  app.use(cookieParser(env.COOKIE_SECRET));
  app.use(requestIdMiddleware);
  app.use(requestLogger);


  const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { error: 'Too many requests, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
      // Exclude SSE, health, and ready endpoints
      if (req.path === '/health' || req.path === '/ready') return true;
      if (req.path.match(/^\/v1\/events\/[^\/]+\/live$/)) return true;
      return false;
    },
  });



  app.use(globalLimiter);

  app.use('/auth', authRouter);
  app.use('/users', usersRouter);
  app.use('/clubs', clubsRouter);
  app.use('/v1/events', sseRouter); // Mounted precisely at GET /events/:id/live
  app.use('/v1/events', eventsRouter);
  app.use('/v1/teams', teamsRouter);
  app.use('/v1', registrationsRouter);
  app.use('/v1', attendanceRouter);
  app.use('/v1/leaderboard', leaderboardRouter);
  app.use('/v1/admin/leaderboard', adminLeaderboardRouter);
  app.use('/v1/admin/users', adminUsersRouter);
  app.use('/v1/admin', adminQueueRouter);
  app.use('/v1/notifications', notificationsRouter);

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.get('/ready', async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ status: 'ready' });
    } catch (err) {
      res.status(503).json({ status: 'error', message: 'Database connection failed' });
    }
  });

  app.use(errorHandler);

  return app;
}
