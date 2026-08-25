import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../infrastructure/api';
import { useToast } from './use-toast';
import { useNetworkStatus } from '../infrastructure/network';

export const useRegistration = (eventId: string) => {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { isOnline } = useNetworkStatus();

  const register = useMutation({
    mutationFn: async () => {
      if (!isOnline) throw { status: 0, message: 'Offline' };
      return apiClient(`/v1/events/${eventId}/register`, { method: 'POST' });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['events', eventId] });
      if (data.status === 'WAITLISTED') {
        toast.show('The event is full. You are on the waitlist.', 'info', 'Waitlisted');
      } else {
        toast.show('You are confirmed for the event.', 'success', 'Registered!');
      }
    },
    onError: (error: any) => {
      if (error.status === 0 || !isOnline) {
        toast.show('You are currently offline.', 'error', 'No Connection');
      } else if (error.status === 401) {
        toast.show('Please log in again.', 'error', 'Session Expired');
      } else if (error.status >= 500) {
        toast.show('An unexpected error occurred.', 'error', 'Server Error');
      } else {
        toast.show('Capacity reached or action invalid.', 'error', 'Action Failed');
      }
    }
  });

  const cancel = useMutation({
    mutationFn: async () => {
      if (!isOnline) throw { status: 0, message: 'Offline' };
      return apiClient(`/v1/events/${eventId}/register`, { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events', eventId] });
    },
    onError: (error: any) => {
      if (error.status === 0 || !isOnline) {
        toast.show('You are currently offline.', 'error', 'No Connection');
      } else if (error.status === 401) {
        toast.show('Please log in again.', 'error', 'Session Expired');
      } else {
        toast.show('Capacity reached or action invalid.', 'error', 'Action Failed');
      }
    }
  });

  return {
    register: register.mutate,
    isRegistering: register.isPending,
    error: register.error,
    cancel: cancel.mutate,
    isCancelling: cancel.isPending,
  };
};
