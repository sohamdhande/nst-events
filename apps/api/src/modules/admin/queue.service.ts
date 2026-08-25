import { prisma, Prisma } from '@nst/database';
import { NotFoundError, UnprocessableEntityError } from '../../lib/errors';
import { withUserContext } from '@nst/database';

export async function getJobs(query: any): Promise<{
  data: any[];
  pagination: {
    next_cursor: string | null;
    has_more: boolean;
  };
}> {
  const { cursor, limit, status, filter_notification_type, filter_user_id, filter_created_after, filter_created_before } = query;

  const where: any = {};

  if (status) {
    where.status = status;
  }

  const andConditions: any[] = [];

  if (filter_notification_type) {
    andConditions.push({
      payload: {
        path: ['job_type'],
        equals: filter_notification_type
      }
    });
  }

  if (filter_user_id) {
    andConditions.push({
      payload: {
        path: ['user_id'],
        equals: filter_user_id
      }
    });
  }

  if (filter_created_after) {
    andConditions.push({ createdAt: { gte: new Date(filter_created_after) } });
  }

  if (filter_created_before) {
    andConditions.push({ createdAt: { lte: new Date(filter_created_before) } });
  }

  if (andConditions.length > 0) {
    where.AND = andConditions;
  }

  const items = await prisma.notificationJob.findMany({
    where,
    take: limit + 1,
    cursor: cursor ? { id: cursor } : undefined,
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      payload: true,
      status: true,
      attemptCount: true,
      lastError: true,
      ticketIds: true,
      idempotencyKey: true,
      availableAt: true,
      createdAt: true,
      updatedAt: true
    }
  });

  let hasMore = false;
  let nextCursor: string | null = null;

  if (items.length > limit) {
    hasMore = true;
    const nextItem = items.pop();
    nextCursor = nextItem!.id;
  }

  const data = items.map((job) => ({
    id: job.id,
    payload: job.payload,
    status: job.status,
    attempt_count: job.attemptCount,
    last_error: job.lastError,
    ticket_ids: job.ticketIds,
    idempotency_key: job.idempotencyKey,
    available_at: job.availableAt,
    created_at: job.createdAt,
    updated_at: job.updatedAt
  }));

  return {
    data,
    pagination: {
      next_cursor: nextCursor,
      has_more: hasMore
    }
  };
}

export async function getDeadLetters(query: any) {
  return getJobs({ ...query, status: 'DEAD_LETTER' });
}

export async function getJobById(jobId: string) {
  const job = await prisma.notificationJob.findUnique({
    where: { id: jobId },
    select: {
      id: true,
      payload: true,
      status: true,
      attemptCount: true,
      maxAttempts: true,
      lastError: true,
      ticketIds: true,
      idempotencyKey: true,
      availableAt: true,
      lockedAt: true,
      workerId: true,
      createdAt: true,
      updatedAt: true
    }
  });

  if (!job) {
    throw new NotFoundError('Job not found');
  }

  return {
    id: job.id,
    payload: job.payload,
    status: job.status,
    attempt_count: job.attemptCount,
    max_attempts: job.maxAttempts,
    last_error: job.lastError,
    ticket_ids: job.ticketIds,
    idempotency_key: job.idempotencyKey,
    available_at: job.availableAt,
    locked_at: job.lockedAt,
    worker_id: job.workerId,
    created_at: job.createdAt,
    updated_at: job.updatedAt
  };
}

export async function retryJob(userId: string, jobId: string) {
  return withUserContext(userId, async (tx) => {
    // 1. Fetch current status safely with SELECT
    const job = await tx.notificationJob.findUnique({
      where: { id: jobId },
      select: { status: true, lastError: true }
    });

    if (!job) {
      throw new NotFoundError('Job not found');
    }

    if (job.status !== 'FAILED') {
      throw new UnprocessableEntityError('Job is not in FAILED state');
    }

    // 2. Perform optimistic atomic UPDATE. 
    // This uses the RLS UPDATE policy and requires `status = 'FAILED'`.
    const { count } = await tx.notificationJob.updateMany({
      where: { id: jobId, status: 'FAILED' },
      data: {
        status: 'PENDING',
        attemptCount: 0,
        lastError: null,
        ticketIds: Prisma.DbNull,
        availableAt: new Date(),
        updatedAt: new Date()
      }
    });

    if (count === 0) {
      throw new UnprocessableEntityError('Job is not in FAILED state'); // Concurrent mutation occurred
    }

    // 3. Fetch the updated row to return it
    const updatedJob = await tx.notificationJob.findUnique({ where: { id: jobId } });

    // 4. Safely audit log
    await tx.auditLog.create({
      data: {
        actorId: userId,
        action: 'QUEUE_JOB_RETRY',
        entityType: 'NOTIFICATION_JOB',
        entityId: jobId,
        previousState: { original_last_error: job.lastError }
      }
    });
    
    return {
      id: updatedJob!.id,
      status: updatedJob!.status,
      attempt_count: updatedJob!.attemptCount,
      last_error: updatedJob!.lastError,
      available_at: updatedJob!.availableAt
    };
  });
}

export async function replayDeadLetter(userId: string, jobId: string) {
  return withUserContext(userId, async (tx) => {
    // 1. Fetch current status safely with SELECT
    const job = await tx.notificationJob.findUnique({
      where: { id: jobId },
      select: { status: true, lastError: true }
    });

    if (!job) {
      throw new NotFoundError('Job not found');
    }

    if (job.status !== 'DEAD_LETTER') {
      throw new UnprocessableEntityError('Job is not in DEAD_LETTER state');
    }

    // 2. Perform optimistic atomic UPDATE.
    const { count } = await tx.notificationJob.updateMany({
      where: { id: jobId, status: 'DEAD_LETTER' },
      data: {
        status: 'PENDING',
        attemptCount: 0,
        lastError: null,
        ticketIds: Prisma.DbNull,
        availableAt: new Date(),
        updatedAt: new Date()
      }
    });

    if (count === 0) {
      throw new UnprocessableEntityError('Job is not in DEAD_LETTER state'); // Concurrent mutation
    }

    const updatedJob = await tx.notificationJob.findUnique({ where: { id: jobId } });

    // 3. Audit Log
    await tx.auditLog.create({
      data: {
        actorId: userId,
        action: 'QUEUE_JOB_REPLAY',
        entityType: 'NOTIFICATION_JOB',
        entityId: jobId,
        previousState: { original_last_error: job.lastError }
      }
    });
    
    return {
      id: updatedJob!.id,
      status: updatedJob!.status,
      attempt_count: updatedJob!.attemptCount,
      last_error: updatedJob!.lastError,
      available_at: updatedJob!.availableAt
    };
  });
}

export async function getQueueMonitoringStats() {
  const counts = await prisma.notificationJob.groupBy({
    by: ['status'],
    _count: {
      _all: true
    }
  });

  const stats = {
    queue_name: 'notifications',
    pending_count: 0,
    processing_count: 0,
    waiting_for_receipts_count: 0,
    retry_pending_count: 0,
    failed_count: 0,
    dead_letter_count: 0,
    archived_count: 0,
    completed_count: 0,
    last_processed_timestamp: null as string | null,
    last_failure_timestamp: null as string | null,
  };

  for (const row of counts) {
    const statusKey = `${row.status.toLowerCase()}_count` as keyof typeof stats;
    if (statusKey in stats) {
      (stats as any)[statusKey] = row._count._all;
    }
  }

  const maxCompleted = await prisma.notificationJob.aggregate({
    where: { status: 'COMPLETED' },
    _max: { updatedAt: true }
  });

  const maxFailed = await prisma.notificationJob.aggregate({
    where: { status: { in: ['FAILED', 'DEAD_LETTER'] } },
    _max: { updatedAt: true }
  });

  stats.last_processed_timestamp = maxCompleted._max.updatedAt?.toISOString() || null;
  stats.last_failure_timestamp = maxFailed._max.updatedAt?.toISOString() || null;

  return stats;
}
