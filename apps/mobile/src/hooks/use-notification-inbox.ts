import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../infrastructure/api';

export interface NotificationPayload {
  id: string;
  type: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
  metadata?: any;
}

export function useNotificationInbox() {
  const queryClient = useQueryClient();

  // 1. Fetch Paginated Inbox
  const {
    data,
    isLoading,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
    isRefetching
  } = useInfiniteQuery({
    queryKey: ['notifications'],
    queryFn: async ({ pageParam = undefined }) => {
      const cursor = pageParam ? `?cursor=${pageParam}&limit=20` : '?limit=20';
      return apiClient(`/v1/notifications${cursor}`);
    },
    initialPageParam: undefined,
    getNextPageParam: (lastPage: any) => {
      if (lastPage.pagination?.has_more) {
        return lastPage.pagination.next_cursor;
      }
      return undefined;
    },
  });

  // 2. Fetch Unread Count (Lightweight query)
  const { data: unreadData } = useInfiniteQuery({
    queryKey: ['notifications', 'unread'],
    queryFn: async () => apiClient(`/v1/notifications?filter_read=false&limit=1`),
    initialPageParam: undefined,
    getNextPageParam: () => undefined,
  });

  const unreadCount = unreadData?.pages?.[0]?.pagination?.total_count ?? 0;

  // 3. Mark Single Notification as Read
  const { mutate: markAsRead } = useMutation({
    mutationFn: async (id: string) => {
      return apiClient(`/v1/notifications/${id}/read`, { method: 'PATCH' });
    },
    onSuccess: () => {
      // Invalidate queries to trigger re-fetch (No optimistic updates as mandated)
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  // 4. Mark All Notifications as Read
  const { mutate: markAllAsRead, isPending: isMarkingAllRead } = useMutation({
    mutationFn: async () => {
      return apiClient(`/v1/notifications/read-all`, { method: 'PATCH' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  return {
    data,
    isLoading,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
    isRefetching,
    unreadCount,
    markAsRead,
    markAllAsRead,
    isMarkingAllRead,
  };
}
