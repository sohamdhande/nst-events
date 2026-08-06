import express, { Express } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env';
import { authRouter } from './modules/auth/auth.router';
import { usersRouter } from './modules/users/users.router';
import { clubsRouter } from './modules/clubs/clubs.router';
import { eventsRouter } from './modules/events/events.router';
import { attendanceRouter } from './modules/attendance/attendance.router';
import { leaderboardRouter, adminLeaderboardRouter } from './modules/leaderboard/leaderboard.router';
import { errorHandler } from './middleware/error-handler';

export function createApp(): Express {
  const app = express();
  
  app.use(
    cors({
      origin: env.ALLOWED_ORIGINS.split(',').map((o) => o.trim()),
      credentials: true,
    })
  );
  app.use(express.json());
  app.use(cookieParser(env.COOKIE_SECRET));

  app.use('/auth', authRouter);
  app.use('/users', usersRouter);
  app.use('/clubs', clubsRouter);
  app.use('/v1/events', eventsRouter);
  app.use('/v1', attendanceRouter);
  app.use('/v1/leaderboard', leaderboardRouter);
  app.use('/v1/admin/leaderboard', adminLeaderboardRouter);

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use(errorHandler);

  return app;
}
