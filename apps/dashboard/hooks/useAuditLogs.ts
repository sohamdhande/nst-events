import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api';

export interface AuditLog {
  id: string;
  action: string;
  actorId: string | null;
  entityType: string;
  entityId: string | null;
  createdAt: string;
  previousState?: Record<string, unknown> | null;
  newState?: Record<string, unknown> | null;
  ipAddress?: string | null;
}

export interface AuditLogsResponse {
  data: AuditLog[];
  pagination: {
    next_cursor?: string;
  };
}

export const useAuditLogs = (options?: { enabled?: boolean }) => {
  return useQuery<AuditLogsResponse>({
    queryKey: ['admin-audit-logs'],
    queryFn: () => apiClient<AuditLogsResponse>('/v1/admin/audit-logs'),
    enabled: options?.enabled !== false,
  });
};
