import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api';

export interface QueueStats {
  pending_count: number;
  processing_count: number;
  waiting_for_receipts_count: number;
  retry_pending_count: number;
  failed_count: number;
  dead_letter_count: number;
  archived_count: number;
  completed_count: number;
}

export interface DeadLetter {
  id: string;
  payload: unknown;
  status: string;
  attempt_count: number;
  last_error: string | null;
  ticket_ids: string[] | null;
  idempotency_key: string | null;
  available_at: string;
  created_at: string;
  updated_at: string;
}

export interface DeadLetterResponse {
  data: DeadLetter[];
  pagination: {
    next_cursor: string | null;
    has_more: boolean;
  };
}

export function useQueueMonitoringStats(options?: { enabled?: boolean }) {
  return useQuery<QueueStats, Error>({
    queryKey: ['admin-queues', 'stats'],
    queryFn: () => apiClient('/v1/admin/queue/monitoring'),
    staleTime: 0,
    enabled: options?.enabled,
  });
}

export function useDeadLetters(filterType?: string) {
  return useInfiniteQuery<DeadLetterResponse, Error>({
    queryKey: ['admin-queues', 'dead-letters', filterType],
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams();
      if (pageParam) params.append('cursor', pageParam as string);
      if (filterType) params.append('filter_notification_type', filterType);
      
      const queryStr = params.toString();
      return apiClient(`/v1/admin/queue/dead-letters${queryStr ? `?${queryStr}` : ''}`);
    },
    initialPageParam: undefined,
    getNextPageParam: (lastPage) => lastPage.pagination.next_cursor || undefined,
  });
}

export function useReplayDeadLetter() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => apiClient(`/v1/admin/queue/dead-letters/${id}/replay`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-queues'] });
    },
  });
}
