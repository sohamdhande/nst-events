import { Request, Response, NextFunction } from 'express';
import { logger } from '../lib/logger';

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
  });

  next();
}
