import test from 'node:test';
import assert from 'node:assert';
import { prisma } from '../../src/lib/prisma';
import { adminPrisma } from '../helpers/adminDb';
import crypto from 'crypto';

// Set mock env vars before importing worker which parses them on load
process.env.EXPO_ACCESS_TOKEN = 'mock_expo_token_for_tests';
process.env.WORKER_DATABASE_URL = 'postgresql://nst_worker:worker_password@localhost:5440/nst_events?schema=public';

import { processBatch } from '../../../worker/src/worker';
import { expo } from '../../../worker/src/index';

test('Worker Reliability and Crash Recovery', async (t) => {
  // Mock Expo so we don't send real pushes
  t.mock.method(expo, 'sendPushNotificationsAsync', async (messages: any[]) => {
    return messages.map(m => ({ status: 'ok', id: `mock-ticket-${Date.now()}` }));
  });

  const testUser = await adminPrisma.user.create({
    data: {
      email: `worker-test-${Date.now()}@test.com`,
      googleSub: `sub-worker-${Date.now()}`,
      fullName: 'Worker User',
    }
  });

  await adminPrisma.pushToken.create({
    data: {
      userId: testUser.id,
      deviceId: `device-${Date.now()}`,
      expoToken: 'ExponentPushToken[mock-token]',
      platform: 'ios'
    }
  });

  const idempotencyKey = crypto.randomBytes(16).toString('hex');
  const payload = {
    job_type: 'SEND_PUSH',
    user_id: testUser.id,
    title: 'Test',
    body: 'Body',
  };

  // 1. Crash Recovery Test (Abandoned Job)
  // Insert a job stuck in PROCESSING with lockedAt older than 5 minutes
  const stuckJob = await adminPrisma.notificationJob.create({
    data: {
      status: 'PROCESSING',
      payload,
      idempotencyKey,
      attemptCount: 1,
      availableAt: new Date(Date.now() - 1000 * 60 * 10),
      lockedAt: new Date(Date.now() - 1000 * 60 * 6), // 6 minutes ago
    }
  });

  // Run batch
  await processBatch();

  // Verify the job was reclaimed and processed
  const recoveredJob = await adminPrisma.notificationJob.findUnique({ where: { id: stuckJob.id } });
  assert.strictEqual(recoveredJob?.status, 'WAITING_FOR_RECEIPTS', 'Abandoned job should be reclaimed and processed');
  
  // 2. Claim Concurrency Test
  // Create 5 jobs
  const jobIds = [];
  for (let i = 0; i < 5; i++) {
    const job = await adminPrisma.notificationJob.create({
      data: {
        status: 'PENDING',
        payload,
        idempotencyKey: crypto.randomBytes(16).toString('hex'),
        availableAt: new Date(Date.now() - 1000 * 60),
      }
    });
    jobIds.push(job.id);
  }

  // Simulate 3 concurrent workers polling
  await Promise.all([
    processBatch(),
    processBatch(),
    processBatch()
  ]);

  const processedJobs = await adminPrisma.notificationJob.findMany({
    where: { id: { in: jobIds } }
  });

  const successJobs = processedJobs.filter(j => j.status === 'WAITING_FOR_RECEIPTS');
  assert.strictEqual(successJobs.length, 5, 'All 5 concurrent jobs should be safely claimed and processed exactly once');
  
  // 3. Retry Exhaustion Test
  // Mock Expo to return transient error
  t.mock.method(expo, 'sendPushNotificationsAsync', async () => {
    throw new Error('network timeout');
  });

  const failJob = await adminPrisma.notificationJob.create({
    data: {
      status: 'PENDING',
      payload,
      idempotencyKey: crypto.randomBytes(16).toString('hex'),
      attemptCount: 4, // Max attempts is 4, so this attempt should transition it to DEAD_LETTER
      availableAt: new Date(Date.now() - 1000 * 60),
    }
  });

  await processBatch();

  const deadJob = await adminPrisma.notificationJob.findUnique({ where: { id: failJob.id } });
  assert.strictEqual(deadJob?.status, 'DEAD_LETTER', 'Job reaching max attempts should transition to DEAD_LETTER');

  // Cleanup
  await adminPrisma.notificationJob.deleteMany({ where: { id: { in: [stuckJob.id, ...jobIds, failJob.id] } } });
  await adminPrisma.pushToken.deleteMany({ where: { userId: testUser.id } });
  await adminPrisma.user.delete({ where: { id: testUser.id } });
});
