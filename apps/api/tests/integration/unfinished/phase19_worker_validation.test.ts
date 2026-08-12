import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { prisma } from '../../src/lib/prisma';
import { dispatchJob } from '../../../worker/src/dispatcher';
import { randomUUID } from 'crypto';

describe('Phase 19 Worker Job Payload Validation', () => {
  let jobId: string;

  before(async () => {
    process.env.EXPO_ACCESS_TOKEN = 'test_token';
    // 1. Manually insert a PENDING job with an invalid payload
    const result = await prisma.$queryRaw<any[]>`
      INSERT INTO notification_jobs (id, payload, status)
      VALUES (
        gen_random_uuid(),
        '{"job_type": "SEND_PUSH", "user_id": 12345}'::jsonb,
        'PENDING'
      )
      RETURNING id, payload, status;
    `;
    jobId = result[0].id;
  });

  after(async () => {
    await prisma.$executeRaw`DELETE FROM notification_jobs WHERE id = ${jobId}::uuid`;
  });

  it('should immediately route a malformed job payload to DEAD_LETTER', async () => {
    // 1. Fetch the raw job as the dispatcher would receive it
    const jobs = await prisma.$queryRaw<any[]>`SELECT * FROM notification_jobs WHERE id = ${jobId}::uuid`;
    const rawJob = jobs[0];

    // 2. Dispatch the job (simulating processBatch)
    const mappedJob = {
      ...rawJob,
      payload: typeof rawJob.payload === 'string' ? JSON.parse(rawJob.payload) : rawJob.payload,
    };

    await dispatchJob(prisma, mappedJob);

    // 3. Verify it was transitioned directly to DEAD_LETTER
    const updatedJobs = await prisma.$queryRaw<any[]>`SELECT status, last_error FROM notification_jobs WHERE id = ${jobId}::uuid`;
    
    assert.strictEqual(updatedJobs[0].status, 'DEAD_LETTER');
    assert.match(updatedJobs[0].last_error, /Malformed payload/);
  });
});
