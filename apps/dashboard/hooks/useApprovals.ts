import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api';

export interface PendingEvent {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  eventClubs: Array<{ club: { name: string } }>;
  state: 'PENDING_APPROVAL';
}

export interface ApprovalsResponse {
  data: PendingEvent[];
  pagination: {
    next_cursor?: string;
    has_more: boolean;
  };
}

export const useApprovals = (clubId?: string) => {
  const queryClient = useQueryClient();

  const query = useQuery<ApprovalsResponse>({
    queryKey: ['events', 'pending', clubId],
    queryFn: () => {
      const url = clubId 
        ? `/v1/events?filter_state=PENDING_APPROVAL&filter_club_id=${clubId}`
        : `/v1/events?filter_state=PENDING_APPROVAL`;
      return apiClient<ApprovalsResponse>(url);
    },
    staleTime: 5 * 60 * 1000,
  });

  const approveMutation = useMutation({
    mutationFn: (eventId: string) =>
      apiClient(`/v1/events/${eventId}/approve`, { method: 'POST' }),
    onSuccess: (_, eventId) => {
      // Optimistic invalidation mapping
      queryClient.setQueryData<ApprovalsResponse>(['events', 'pending', clubId], (oldData) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          data: oldData.data.filter((evt) => evt.id !== eventId),
        };
      });
      queryClient.invalidateQueries({ queryKey: ['events', 'pending'] });
      queryClient.invalidateQueries({ queryKey: ['events', 'list'] });
      queryClient.invalidateQueries({ queryKey: ['event', eventId] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ eventId, reason }: { eventId: string; reason: string }) =>
      apiClient(`/v1/events/${eventId}/reject`, {
        method: 'POST',
        body: JSON.stringify({ rejection_reason: reason }),
      }),
    onSuccess: (_, { eventId }) => {
      queryClient.setQueryData<ApprovalsResponse>(['events', 'pending', clubId], (oldData) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          data: oldData.data.filter((evt) => evt.id !== eventId),
        };
      });
      queryClient.invalidateQueries({ queryKey: ['events', 'pending'] });
      queryClient.invalidateQueries({ queryKey: ['events', 'list'] });
      queryClient.invalidateQueries({ queryKey: ['event', eventId] });
    },
  });

  return {
    ...query,
    approveMutation,
    rejectMutation,
  };
};
