import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api';

export function useEventLifecycle() {
  const queryClient = useQueryClient();

  const onSuccess = (_: unknown, eventId: string) => {
    queryClient.invalidateQueries({ queryKey: ['events', 'list'] });
    queryClient.invalidateQueries({ queryKey: ['event', eventId] });
    queryClient.invalidateQueries({ queryKey: ['events', 'pending'] });
    queryClient.invalidateQueries({ queryKey: ['registrations', eventId] });
    queryClient.invalidateQueries({ queryKey: ['event-teams', eventId] });
    queryClient.invalidateQueries({ queryKey: ['attendance', eventId] });
  };

  const submitMutation = useMutation({
    mutationFn: (eventId: string) => apiClient(`/v1/events/${eventId}/submit-for-approval`, { method: 'POST' }),
    onSuccess,
  });

  const approveMutation = useMutation({
    mutationFn: (eventId: string) => apiClient(`/v1/events/${eventId}/approve`, { method: 'POST' }),
    onSuccess,
  });

  const rejectMutation = useMutation({
    mutationFn: ({ eventId, reason }: { eventId: string; reason: string }) => 
      apiClient(`/v1/events/${eventId}/reject`, { 
        method: 'POST',
        body: JSON.stringify({ rejection_reason: reason }),
      }),
    onSuccess: (_, { eventId }) => onSuccess(_, eventId),
  });

  const lockMutation = useMutation({
    mutationFn: (eventId: string) => apiClient(`/v1/events/${eventId}/lock`, { method: 'POST' }),
    onSuccess,
  });

  const unlockMutation = useMutation({
    mutationFn: (eventId: string) => apiClient(`/v1/events/${eventId}/unlock`, { method: 'POST' }),
    onSuccess,
    onError: (_err, eventId) => {
      queryClient.invalidateQueries({ queryKey: ['event', eventId] });
      queryClient.invalidateQueries({ queryKey: ['events', 'list'] });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (eventId: string) => apiClient(`/v1/events/${eventId}`, { method: 'DELETE' }),
    onSuccess: (_, eventId) => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.removeQueries({ queryKey: ['event', eventId] });
    }
  });

  return {
    submitMutation,
    approveMutation,
    rejectMutation,
    lockMutation,
    unlockMutation,
    deleteMutation,
  };
}
