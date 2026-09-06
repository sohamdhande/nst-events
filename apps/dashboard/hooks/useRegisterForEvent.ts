import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api';
import { RegistrationStatus } from './useEventDetail';

export function useRegisterForEvent(eventId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => apiClient(`/v1/events/${eventId}/register`, { method: 'POST' }),
    onSuccess: () => {
      // The API dependency matrix requires invalidating the registration query
      queryClient.invalidateQueries({ queryKey: ['event-my-registration', eventId] });
      // Event list or detail caching might also need invalidation to recount
      queryClient.invalidateQueries({ queryKey: ['event', eventId] });
      queryClient.invalidateQueries({ queryKey: ['my-registrations'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
    },
  });
}

export function useCancelRegistration(eventId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => apiClient(`/v1/events/${eventId}/register`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-my-registration', eventId] });
      queryClient.invalidateQueries({ queryKey: ['event', eventId] });
      queryClient.invalidateQueries({ queryKey: ['my-registrations'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
    },
  });
}
