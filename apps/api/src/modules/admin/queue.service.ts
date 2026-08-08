import { prisma } from '@nst/database';
import { NotFoundError, UnprocessableEntityError } from '../../lib/errors';

export async function getQueueMonitoringStats() {
  const counts = await prisma.notificationJob.groupBy({
    by: ['status'],
    _count: {
      _all: true
    }
  });

  const stats = {
    pending_count: 0,
    processing_count: 0,
    waiting_for_receipts_count: 0,
    retry_pending_count: 0,
    failed_count: 0,
    dead_letter_count: 0,
    archived_count: 0,
    completed_count: 0,
  };

  for (const row of counts) {
    const statusKey = `${row.status.toLowerCase()}_count` as keyof typeof stats;
    if (statusKey in stats) {
      stats[statusKey] = row._count._all;
    }
  }

  return stats;
}

export async function getDeadLetters(query: any): Promise<{
  data: any[];
  pagination: {
    next_cursor: string | null;
    has_more: boolean;
  };
}> {
  const { cursor, limit, filter_notification_type, filter_user_id, filter_created_after, filter_created_before } = query;

  const where: any = {
    status: 'DEAD_LETTER'
  };

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

  // Map to snake_case as expected in response
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

export async function replayDeadLetter(userId: string, jobId: string) {
  return prisma.$transaction(async (tx) => {
    // We lock the row to avoid race conditions
    const job = await tx.$queryRaw<{ id: string, status: string, last_error: string }[]>`
      SELECT id, status, last_error FROM notification_jobs WHERE id = ${jobId}::uuid FOR UPDATE
    `;

    if (!job || job.length === 0) {
      throw new NotFoundError('Job not found');
    }

    if (job[0].status !== 'DEAD_LETTER') {
      throw new UnprocessableEntityError('Job is not in DEAD_LETTER state');
    }

    const originalLastError = job[0].last_error;

    // Reset status to PENDING, attempt_count = 0, last_error = null, ticket_ids = null, available_at = now()
    const updatedJob = await tx.$queryRaw<{ id: string, status: string, attempt_count: number, last_error: string | null, available_at: Date }[]>`
      UPDATE notification_jobs
      SET status = 'PENDING',
          attempt_count = 0,
          last_error = NULL,
          ticket_ids = NULL,
          available_at = now(),
          updated_at = now()
      WHERE id = ${jobId}::uuid
      RETURNING id, status, attempt_count, last_error, available_at
    `;

    // Audit Log
    await tx.auditLog.create({
      data: {
        actorId: userId,
        action: 'QUEUE_JOB_REPLAY',
        entityType: 'NOTIFICATION_JOB',
        entityId: jobId,
        previousState: { original_last_error: originalLastError }
      }
    });
    
    return updatedJob[0];
  });
}
