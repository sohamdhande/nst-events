import { Router } from 'express';
import { sseEventBus } from './event-bus';
import { sseConnectionManager } from './sse-connection-manager';
import { authenticate } from '../../middleware/authenticate';

import { buildEventChannel } from './sse.utils';
import * as eventsService from '../events/events.service';

export const sseRouter: Router = Router();

// Middleware to support query param 'token' as Bearer token for EventSource
const sseAuthMiddleware = (req: any, res: any, next: any) => {
  if (req.query.token && !req.headers.authorization) {
    req.headers.authorization = `Bearer ${req.query.token}`;
  }
  return authenticate(req, res, next);
};

sseRouter.get('/:id/live', sseAuthMiddleware, async (req, res, next) => {
  try {
    const eventId = req.params.id;
    const channel = buildEventChannel(eventId);
    
    // Enforce Event Read Authorization before subscribing to SSE notifications
    await eventsService.checkEventReadAuthorization(req.user!.id, eventId);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    // Subscribe to DB notifications via manager
    await sseConnectionManager.subscribe(eventId);

    const onEvent = (payload: any) => {
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    sseEventBus.on(channel, onEvent);

    const onSystemDisconnect = () => {
      res.end(); // Closes the stream, forcing the EventSource client to reconnect and resync
    };
    sseEventBus.on('system:disconnect', onSystemDisconnect);

    // 30s Heartbeat as per documentation contract
    const heartbeatInterval = setInterval(() => {
      res.write(`data: ${JSON.stringify({ type: 'heartbeat', payload: { timestamp: new Date().toISOString() } })}\n\n`);
    }, 30000);

    // Strict connection cleanup
    req.on('close', async () => {
      clearInterval(heartbeatInterval);
      sseEventBus.off(channel, onEvent);
      sseEventBus.off('system:disconnect', onSystemDisconnect);
      await sseConnectionManager.unsubscribe(eventId);
    });

  } catch (err) {
    next(err);
  }
});
