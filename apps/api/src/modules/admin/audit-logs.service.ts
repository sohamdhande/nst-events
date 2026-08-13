import { prisma } from '../../lib/prisma';
import { ListAuditLogsQuery } from './audit-logs.schema';

export interface AuditLogData {
  id: string;
  action: string;
  actorId: string | null;
  entityType: string;
  entityId: string | null;
  createdAt: string;
  previousState: any;
  newState: any;
  ipAddress: string | null;
}

export interface ListAuditLogsResult {
  data: AuditLogData[];
  pagination: {
    next_cursor?: string;
  };
}

export const auditLogsService = {
  async listLogs(query: ListAuditLogsQuery): Promise<ListAuditLogsResult> {
    const { cursor, limit, entityType, actorId } = query;

    const where: any = {};
    if (entityType) where.entityType = entityType;
    if (actorId) where.actorId = actorId;

    const items = await prisma.auditLog.findMany({
      where,
      take: limit + 1,
      cursor: cursor ? { id: BigInt(cursor) } : undefined,
      orderBy: { id: 'desc' },
      select: {
        id: true,
        action: true,
        actorId: true,
        entityType: true,
        entityId: true,
        createdAt: true,
        previousState: true,
        newState: true,
        ipAddress: true,
      }
    });

    let nextCursor: string | undefined = undefined;
    if (items.length > limit) {
      const nextItem = items.pop();
      nextCursor = nextItem!.id.toString();
    }

    // Convert BigInt to string for JSON serialization
    const data = items.map(item => ({
      ...item,
      id: item.id.toString(),
      createdAt: item.createdAt.toISOString()
    }));

    return {
      data,
      pagination: {
        next_cursor: nextCursor,
      },
    };
  },
};
