import express from 'express';
import { PrismaClient } from '@nst/database';
import { Expo } from 'expo-server-sdk';
import { config } from './config';
import { startWorkerLoop, stopWorkerLoop, isShuttingDown } from './worker';
import { logger, generateCorrelationId } from './lib/logger';
import { registry, queueDepth } from './lib/metrics';

// Initialize Prisma
export const prisma: PrismaClient = new PrismaClient({
  datasources: {
    db: {
      url: config.DATABASE_URL,
    },
  },
});

// Initialize Expo SDK
export const expo = new Expo({
  accessToken: config.EXPO_ACCESS_TOKEN,
  useFcmV1: true,
});

const app = express();

export let isInitialized = false;
let queueDepthInterval: NodeJS.Timeout;

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/ready', async (req, res) => {
  let dbStatus = 'disconnected';
  let dbHealthy = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbStatus = 'connected';
    dbHealthy = true;
  } catch (err) {
    dbStatus = 'disconnected';
    dbHealthy = false;
  }

  const isReady = isInitialized && dbHealthy && !isShuttingDown;
  
  res.status(isReady ? 200 : 503).json({
    status: isReady ? 'ok' : 'error',
    database: dbStatus,
    shutting_down: isShuttingDown,
    initialized: isInitialized,
    timestamp: new Date().toISOString(),
  });
});

app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', registry.contentType);
    res.end(await registry.metrics());
  } catch (err: any) {
    res.status(500).end(err.message);
  }
});

async function updateQueueDepth() {
  try {
    const results: any[] = await prisma.$queryRaw`
      SELECT status, COUNT(*) as count 
      FROM notification_jobs 
      GROUP BY status
    `;
    
    // Reset all statuses to 0 before updating to avoid stale metrics
    queueDepth.reset();
    
    for (const row of results) {
      queueDepth.labels({ status: row.status }).set(Number(row.count));
    }
  } catch (err: any) {
    logger.error({ error: { failure_reason: 'QueueDepthCollectionError', stack: err.stack } }, '❌ Failed to collect queue depth metrics');
  }
}

let server: ReturnType<typeof app.listen>;

async function startup() {
  const correlation_id = generateCorrelationId();
  logger.info({ correlation_id }, '🚀 Starting Notification Worker...');
  
  try {
    await prisma.$connect();
    logger.info({ correlation_id }, '✅ Prisma connected');
  } catch (err: any) {
    logger.error({ correlation_id, error: { failure_reason: 'PrismaConnectionFailed', stack: err.stack } }, '❌ Prisma connection failed during startup');
    process.exit(1);
  }

  logger.info({ correlation_id }, '✅ Worker runtime components loaded');

  server = app.listen(3002, () => {
    logger.info({ correlation_id }, '🏥 Health, Readiness & Metrics server listening on port 3002');
  });

  isInitialized = true;
  logger.info({ correlation_id }, '✅ Worker initialized');

  // Start periodic queue depth collection every 15s
  updateQueueDepth();
  queueDepthInterval = setInterval(updateQueueDepth, 15000);

  startWorkerLoop();
}

async function shutdown(signal: string) {
  const correlation_id = generateCorrelationId();
  logger.info({ correlation_id }, `\n🛑 Received ${signal}. Initiating graceful shutdown...`);
  
  if (queueDepthInterval) {
    clearInterval(queueDepthInterval);
  }

  await stopWorkerLoop();
  
  try {
    if (server) {
      server.close();
      logger.info({ correlation_id }, '🏥 HTTP server closed.');
    }
    
    await prisma.$disconnect();
    logger.info({ correlation_id }, '💾 Prisma disconnected.');
  } catch (err: any) {
    logger.error({ correlation_id, error: { failure_reason: 'ShutdownError', stack: err.stack } }, '❌ Error during shutdown');
  } finally {
    logger.info({ correlation_id }, '👋 Worker exited cleanly.');
    process.exitCode = 0;
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

if (require.main === module || process.argv[1]?.includes('worker/src/index')) {
  startup().catch((err: any) => {
    logger.error({ correlation_id: generateCorrelationId(), error: { failure_reason: 'FatalStartupError', stack: err.stack } }, '❌ Fatal error during startup');
    process.exitCode = 1;
  });
}


