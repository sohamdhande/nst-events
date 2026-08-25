import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api';

export interface Notification {
  id: string;
  title: string;
  body: string;
  type: string;
  metadata: any;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationsResponse {
  data: Notification[];
  pagination: {
    next_cursor?: string;
    has_more: boolean;
  };
}

export function useUnreadCount() {
  return useQuery<{ unread_count: number }, Error>({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => apiClient('/v1/notifications/unread-count'),
    staleTime: 5 * 60 * 1000,
  });
}

export function useNotifications(options?: { filter_read?: boolean }) {
  const filterParams = options?.filter_read !== undefined 
    ? `&filter_read=${options.filter_read}` 
    : '';

  return useInfiniteQuery<NotificationsResponse, Error>({
    queryKey: ['notifications', options?.filter_read],
    queryFn: ({ pageParam }) => {
      const url = pageParam 
        ? `/v1/notifications?limit=20&cursor=${pageParam}${filterParams}` 
        : `/v1/notifications?limit=20${filterParams}`;
      return apiClient<NotificationsResponse>(url);
    },
    initialPageParam: undefined,
    getNextPageParam: (lastPage) => lastPage.pagination.next_cursor,
    staleTime: 5 * 60 * 1000,
  });
}

export function useReadNotification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (notificationId: string) => 
      apiClient(`/v1/notifications/${notificationId}/read`, { method: 'PATCH' }),
    onSuccess: (data, notificationId) => {
      // Optimistically or deterministically invalidate so it recounts/renders correctly
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useReadAllNotifications() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => apiClient(`/v1/notifications/read-all`, { method: 'PATCH' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}
