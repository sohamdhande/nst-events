import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api';

export function useAdminCancelTeam(eventId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (teamId: string) => apiClient(`/v1/admin/teams/${teamId}/cancel`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-teams', eventId] });
      queryClient.invalidateQueries({ queryKey: ['event', eventId] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['registrations', eventId] });
    },
  });
}

export function useAdminRemoveMember(eventId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ teamId, userId }: { teamId: string; userId: string }) => 
      apiClient(`/v1/admin/teams/${teamId}/members/${userId}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-teams', eventId] });
      queryClient.invalidateQueries({ queryKey: ['event', eventId] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['registrations', eventId] });
    },
  });
}

export function useAdminTransferLeadership(eventId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ teamId, newLeaderId }: { teamId: string; newLeaderId: string }) => 
      apiClient(`/v1/admin/teams/${teamId}/transfer-leadership`, { 
        method: 'POST',
        body: JSON.stringify({ new_leader_id: newLeaderId }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-teams', eventId] });
      queryClient.invalidateQueries({ queryKey: ['event', eventId] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['registrations', eventId] });
    },
  });
}

export function useAdminPromoteWaitlist(eventId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (teamId: string) => apiClient(`/v1/admin/teams/${teamId}/promote-waitlist`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-teams', eventId] });
      queryClient.invalidateQueries({ queryKey: ['event', eventId] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['registrations', eventId] });
    },
  });
}
