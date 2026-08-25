import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { adminPrisma as prisma } from '../helpers/adminDb';
import request from 'supertest';
import { createApp } from '../../src/app';

import { signJwt } from '../../src/lib/jwt';

const app = createApp();

let platformAdminToken: string;
let studentToken: string;

let platformAdminId: string;
let studentId: string;
let jobIdFailed: string;
let jobIdDeadLetter: string;
let jobIdProcessing: string;

before(async () => {
  // Clear any existing jobs for isolation
  await prisma.notificationJob.deleteMany({});
  await prisma.user.deleteMany({
    where: { email: { in: ['platform_admin_queue@nst.com', 'student_queue@nst.com'] } }
  });

  const pa = await prisma.user.create({
    data: {
      id: '00000000-0000-0000-0000-000000000070',
      email: 'platform_admin_queue@nst.com',
      fullName: 'Queue PA',
      globalRole: 'PLATFORM_ADMIN',
      googleSub: 'sub_pa_queue'
    }
  });
  platformAdminId = pa.id;

  const st = await prisma.user.create({
    data: {
      id: '00000000-0000-0000-0000-000000000071',
      email: 'student_queue@nst.com',
      fullName: 'Queue Student',
      globalRole: 'STUDENT',
      googleSub: 'sub_st_queue'
    }
  });
  studentId = st.id;

  platformAdminToken = signJwt(platformAdminId);
  studentToken = signJwt(studentId);

  const j1 = await prisma.notificationJob.create({
    data: {
      status: 'FAILED',
      payload: { job_type: 'EVENT_REMINDER', user_id: studentId },
      attemptCount: 4,
      maxAttempts: 4,
      lastError: 'Simulated connection error',
      idempotencyKey: 'test-failed-1'
    }
  });
  jobIdFailed = j1.id;

  const j2 = await prisma.notificationJob.create({
    data: {
      status: 'DEAD_LETTER',
      payload: { job_type: 'CLUB_ANNOUNCEMENT' },
      attemptCount: 4,
      maxAttempts: 4,
      lastError: 'Fatal logic error',
      idempotencyKey: 'test-dl-1'
    }
  });
  jobIdDeadLetter = j2.id;

  const j3 = await prisma.notificationJob.create({
    data: {
      status: 'PROCESSING',
      payload: { job_type: 'ATTENDANCE_ALERT' },
      attemptCount: 1,
      maxAttempts: 4,
      idempotencyKey: 'test-proc-1'
    }
  });
  jobIdProcessing = j3.id;
  
  await prisma.notificationJob.create({
    data: {
      status: 'COMPLETED',
      payload: { job_type: 'SYSTEM' },
      attemptCount: 1,
      maxAttempts: 4,
      idempotencyKey: 'test-comp-1'
    }
  });
});

after(async () => {
  await prisma.auditLog.deleteMany({ where: { entityId: { in: [jobIdFailed, jobIdDeadLetter, jobIdProcessing].filter(Boolean) as string[] } } });
  await prisma.notificationJob.deleteMany({});
  await prisma.user.deleteMany({
    where: { id: { in: [platformAdminId, studentId] } }
  });
});

describe('Queue Operations API', () => {
  it('Denies access to unauthorized roles', async () => {
    const res = await request(app)
      .get('/v1/admin/queue/jobs')
      .set('Authorization', `Bearer ${studentToken}`);
    assert.strictEqual(res.status, 403);
  });

  it('Allows PLATFORM_ADMIN to list jobs and filters correctly', async () => {
    const res = await request(app)
      .get('/v1/admin/queue/jobs')
      .query({ filter_status: 'FAILED', filter_notification_type: 'EVENT_REMINDER' })
      .set('Authorization', `Bearer ${platformAdminToken}`);
    
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.data.length, 1);
    assert.strictEqual(res.body.data[0].id, jobIdFailed);
    assert.strictEqual(res.body.data[0].payload.job_type, 'EVENT_REMINDER');
    assert.strictEqual(res.body.data[0].status, 'FAILED');
  });

  it('Fetches job detail safely', async () => {
    const res = await request(app)
      .get(`/v1/admin/queue/jobs/${jobIdFailed}`)
      .set('Authorization', `Bearer ${platformAdminToken}`);
    
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.id, jobIdFailed);
    assert.strictEqual(res.body.status, 'FAILED');
    assert.strictEqual(res.body.attempt_count, 4);
    assert.strictEqual(res.body.last_error, 'Simulated connection error');
  });

  it('Rejects generic retry for PENDING/PROCESSING jobs', async () => {
    const res = await request(app)
      .post(`/v1/admin/queue/jobs/${jobIdProcessing}/retry`)
      .set('Authorization', `Bearer ${platformAdminToken}`);
    
    assert.strictEqual(res.status, 422);
    assert.strictEqual(res.body.detail, 'Job is not in FAILED state');
  });

  it('Rejects generic retry for DEAD_LETTER jobs', async () => {
    const res = await request(app)
      .post(`/v1/admin/queue/jobs/${jobIdDeadLetter}/retry`)
      .set('Authorization', `Bearer ${platformAdminToken}`);
    
    console.log('DEAD_LETTER retry response:', res.status, res.body, res.text);
    assert.strictEqual(res.status, 422);
    assert.strictEqual(res.body.detail, 'Job is not in FAILED state');
  });

  it('Successfully retries a FAILED job', async () => {
    // Let's see what the status is before we try to retry
    const resCheck = await request(app)
      .get(`/v1/admin/queue/jobs/${jobIdFailed}`)
      .set('Authorization', `Bearer ${platformAdminToken}`);
    
    console.log('Status before retry:', resCheck.body.status);

    const res = await request(app)
      .post(`/v1/admin/queue/jobs/${jobIdFailed}/retry`)
      .set('Authorization', `Bearer ${platformAdminToken}`);
    
    
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, 'PENDING');
    assert.strictEqual(res.body.attempt_count, 0);
    assert.strictEqual(res.body.last_error, null);

    // Verify it prevents double retry
    const res2 = await request(app)
      .post(`/v1/admin/queue/jobs/${jobIdFailed}/retry`)
      .set('Authorization', `Bearer ${platformAdminToken}`);
    
    assert.strictEqual(res2.status, 422);
    assert.strictEqual(res2.body.detail, 'Job is not in FAILED state');

    // Verify Audit Log
    const audit = await prisma.auditLog.findFirst({
      where: { entityId: jobIdFailed, action: 'QUEUE_JOB_RETRY' }
    });
    assert.ok(audit);
    assert.strictEqual(audit.actorId, platformAdminId);
    assert.deepStrictEqual(audit.previousState, { original_last_error: 'Simulated connection error' });
  });

  it('Successfully replays a DEAD_LETTER job', async () => {
    const res = await request(app)
      .post(`/v1/admin/queue/dead-letters/${jobIdDeadLetter}/replay`)
      .set('Authorization', `Bearer ${platformAdminToken}`);
    
    assert.strictEqual(res.status, 200, `Expected 200 but got ${res.status}. Body: ${JSON.stringify(res.body)}`);
    assert.strictEqual(res.body.status, 'PENDING');
    assert.strictEqual(res.body.attempt_count, 0);
  });

  it('Monitoring endpoint returns correct counts and timestamps', async () => {
    const res = await request(app)
      .get('/v1/admin/queue/monitoring')
      .set('Authorization', `Bearer ${platformAdminToken}`);
    
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.queue_name, 'notifications');
    // We expect COMPLETED count to be 1
    assert.strictEqual(res.body.completed_count, 1);
    assert.ok(res.body.last_processed_timestamp);
    assert.strictEqual(res.body.last_failure_timestamp, null); // All failed/dead letter jobs were retried
  });
});
