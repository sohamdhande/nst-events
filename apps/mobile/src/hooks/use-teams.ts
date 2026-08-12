import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../infrastructure/api';
import { useToast } from './use-toast';
import { useNetworkStatus } from '../infrastructure/network';

export const useTeams = (eventId: string) => {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { isOnline } = useNetworkStatus();

  const createTeam = useMutation({
    mutationFn: async (name: string) => {
      if (!isOnline) throw { status: 0, message: 'Offline' };
      return apiClient(`/v1/events/${eventId}/teams`, {
        method: 'POST',
        body: JSON.stringify({ name })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events', eventId] });
      queryClient.invalidateQueries({ queryKey: ['teams', eventId] });
      toast.show('Team Created.', 'success', 'Success');
    },
    onError: (error: any) => {
      handleError(error, toast, isOnline);
    }
  });

  const joinTeam = useMutation({
    mutationFn: async (teamId: string) => {
      if (!isOnline) throw { status: 0, message: 'Offline' };
      return apiClient(`/v1/teams/${teamId}/join`, { method: 'POST' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events', eventId] });
      queryClient.invalidateQueries({ queryKey: ['teams', eventId] });
      toast.show('You joined the team.', 'success', 'Team Joined');
    },
    onError: (error: any) => {
      handleError(error, toast, isOnline);
    }
  });

  const leaveTeam = useMutation({
    mutationFn: async (teamId: string) => {
      if (!isOnline) throw { status: 0, message: 'Offline' };
      return apiClient(`/v1/teams/${teamId}/leave`, { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events', eventId] });
      queryClient.invalidateQueries({ queryKey: ['teams', eventId] });
      toast.show('You left the team.', 'info', 'Team Left');
    },
    onError: (error: any) => {
      handleError(error, toast, isOnline);
    }
  });

  return {
    createTeam: createTeam.mutate,
    isCreating: createTeam.isPending,
    joinTeam: joinTeam.mutate,
    isJoining: joinTeam.isPending,
    leaveTeam: leaveTeam.mutate,
    isLeaving: leaveTeam.isPending,
  };
};

function handleError(error: any, toast: any, isOnline: boolean) {
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
