import { Request, Response, NextFunction } from 'express';
import { logger } from '../lib/logger';

// Lightweight in-memory tracking for 401/403 alerting
interface ViolationWindow {
  count: number;
  resetAt: number;
}
const violationCounts = new Map<string, ViolationWindow>();
const THRESHOLD = 20;
const WINDOW_MS = 5 * 60 * 1000;

// Periodic cleanup to prevent unbounded memory growth (OOM protection)
setInterval(() => {
  const now = Date.now();
  for (const [identifier, window] of violationCounts.entries()) {
    if (now > window.resetAt) {
      violationCounts.delete(identifier);
    }
  }
}, 10 * 60 * 1000).unref(); // unref so it doesn't block process exit

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const startTime = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const { method, originalUrl } = req;
    const { statusCode } = res;

    // Do not log sensitive headers/bodies.
    // We only log basic routing and status to prove correlation ID tracing works.
    logger.info(
      {
        request_id: req.id,
        method,
        url: originalUrl,
        status: statusCode,
        duration_ms: duration,
      },
      `${method} ${originalUrl} ${statusCode}`
    );

    // Track 401/403 responses
    if (statusCode === 401 || statusCode === 403) {
      const identifier = (req as any).user?.id || req.ip || 'unknown';
      const now = Date.now();
      
      let window = violationCounts.get(identifier);
      if (!window || now > window.resetAt) {
        window = { count: 0, resetAt: now + WINDOW_MS };
      }
      
      window.count++;
      violationCounts.set(identifier, window);

      if (window.count >= THRESHOLD) {
        logger.warn(
          {
            suspicious_identifier: identifier,
            violation_count: window.count,
            time_window_ms: WINDOW_MS,
            triggering_url: originalUrl,
            event: 'HIGH_AUTH_FAILURE_RATE'
          },
          `High rate of 401/403 responses detected from identifier: ${identifier}`
        );
        // Reset count to avoid log spam for the remainder of the window
        window.count = 0; 
      }
    }
  });

  next();
}
