import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

// Augment the Express Request type
declare global {
  namespace Express {
    interface Request {
      id: string;
    }
  }
}

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  // Respect incoming X-Request-ID if provided and valid UUID, otherwise generate
  const incomingId = req.header('X-Request-ID');
  
  // Basic sanity check to prevent arbitrary massive strings being passed as request IDs
  if (incomingId && typeof incomingId === 'string' && incomingId.length <= 100) {
    req.id = incomingId;
  } else {
    req.id = randomUUID();
  }

  // Set response header
  res.setHeader('X-Request-ID', req.id);
  next();
}
