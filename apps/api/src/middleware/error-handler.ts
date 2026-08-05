import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { env } from '../config/env';
import { AppError } from '../lib/errors';

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  const instance = req.originalUrl || req.url;

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      type: err.type,
      title: err.title,
      status: err.statusCode,
      detail: err.message,
      instance,
    });
    return;
  }

  if (err instanceof z.ZodError) {
    const detail = err.issues.map((issue) => issue.message).join(', ');
    res.status(400).json({
      type: 'https://api.nstsdc.org/errors/bad-request',
      title: 'Bad Request',
      status: 400,
      detail,
      instance,
    });
    return;
  }

  const message =
    err instanceof Error ? err.message : 'An unexpected error occurred';
  const detail =
    env.NODE_ENV === 'production'
      ? 'An unexpected error occurred'
      : message;

  res.status(500).json({
    type: 'https://api.nstsdc.org/errors/internal-server-error',
    title: 'Internal Server Error',
    status: 500,
    detail,
    instance,
  });
}

export default errorHandler;
