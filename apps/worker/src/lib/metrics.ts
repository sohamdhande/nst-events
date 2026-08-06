import client from 'prom-client';

// Singleton registry
export const registry = new client.Registry();

// Default metrics
client.collectDefaultMetrics({ register: registry });

// Canonical Metrics
export const jobsProcessedTotal = new client.Counter({
  name: 'nst_jobs_processed_total',
  help: 'Total number of notification jobs that reached a terminal or successful state',
  labelNames: ['status', 'notification_type'],
  registers: [registry],
});

export const queueDepth = new client.Gauge({
  name: 'nst_queue_depth',
  help: 'The current number of jobs sitting in the queue, grouped by their lifecycle status',
  labelNames: ['status'],
  registers: [registry],
});

export const processingDuration = new client.Histogram({
  name: 'nst_processing_duration_seconds',
  help: 'Processing latency from the moment a job is claimed to the moment its execution block completes',
  labelNames: ['job_type'],
  buckets: [0.1, 0.5, 1, 2, 5, 15, 30],
  registers: [registry],
});

export const expoApiErrorsTotal = new client.Counter({
  name: 'nst_expo_api_errors_total',
  help: 'Total number of Expo API errors encountered during push sending or receipt polling',
  labelNames: ['error_code'],
  registers: [registry],
});
