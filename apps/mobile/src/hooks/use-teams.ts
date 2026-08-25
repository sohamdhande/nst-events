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
        body: JSON.stringify({ team_name: name })
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

  const inviteMember = useMutation({
    mutationFn: async ({ teamId, inviteeId }: { teamId: string, inviteeId: string }) => {
      if (!isOnline) throw { status: 0, message: 'Offline' };
      return apiClient(`/v1/teams/${teamId}/invitations`, { 
        method: 'POST',
        body: JSON.stringify({ invitee_id: inviteeId })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams', eventId] });
      queryClient.invalidateQueries({ queryKey: ['sent-invitations'] });
      toast.show('Invitation sent successfully.', 'success', 'Success');
    },
    onError: (error: any) => {
      handleError(error, toast, isOnline);
    }
  });

  const acceptInvitation = useMutation({
    mutationFn: async ({ teamId, invitationId }: { teamId: string, invitationId: string }) => {
      if (!isOnline) throw { status: 0, message: 'Offline' };
      return apiClient(`/v1/teams/${teamId}/invitations/${invitationId}/accept`, { method: 'POST' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events', eventId] });
      queryClient.invalidateQueries({ queryKey: ['teams', eventId] });
      queryClient.invalidateQueries({ queryKey: ['invitations'] });
      toast.show('Invitation accepted.', 'success', 'Success');
    },
    onError: (error: any) => {
      handleError(error, toast, isOnline);
    }
  });

  const declineInvitation = useMutation({
    mutationFn: async ({ teamId, invitationId }: { teamId: string, invitationId: string }) => {
      if (!isOnline) throw { status: 0, message: 'Offline' };
      return apiClient(`/v1/teams/${teamId}/invitations/${invitationId}/decline`, { method: 'POST' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invitations'] });
      toast.show('Invitation declined.', 'info', 'Declined');
    },
    onError: (error: any) => {
      handleError(error, toast, isOnline);
    }
  });

  const cancelInvitation = useMutation({
    mutationFn: async ({ teamId, invitationId }: { teamId: string, invitationId: string }) => {
      if (!isOnline) throw { status: 0, message: 'Offline' };
      return apiClient(`/v1/teams/${teamId}/invitations/${invitationId}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams', eventId] });
      queryClient.invalidateQueries({ queryKey: ['sent-invitations'] });
      toast.show('Invitation cancelled.', 'info', 'Cancelled');
    },
    onError: (error: any) => {
      handleError(error, toast, isOnline);
    }
  });

  const removeMember = useMutation({
    mutationFn: async ({ teamId, userId }: { teamId: string, userId: string }) => {
      if (!isOnline) throw { status: 0, message: 'Offline' };
      return apiClient(`/v1/teams/${teamId}/members/${userId}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams', eventId] });
      queryClient.invalidateQueries({ queryKey: ['events', eventId] });
      toast.show('Member removed.', 'success', 'Success');
    },
    onError: (error: any) => {
      handleError(error, toast, isOnline);
    }
  });

  const transferLeadership = useMutation({
    mutationFn: async ({ teamId, newLeaderId }: { teamId: string, newLeaderId: string }) => {
      if (!isOnline) throw { status: 0, message: 'Offline' };
      return apiClient(`/v1/teams/${teamId}/transfer-leadership`, { 
        method: 'POST',
        body: JSON.stringify({ new_leader_id: newLeaderId })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams', eventId] });
      toast.show('Leadership transferred.', 'success', 'Success');
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
    inviteMember: inviteMember.mutate,
    isInviting: inviteMember.isPending,
    acceptInvitation: acceptInvitation.mutate,
    isAccepting: acceptInvitation.isPending,
    declineInvitation: declineInvitation.mutate,
    isDeclining: declineInvitation.isPending,
    cancelInvitation: cancelInvitation.mutate,
    isCancelling: cancelInvitation.isPending,
    removeMember: removeMember.mutate,
    isRemoving: removeMember.isPending,
    transferLeadership: transferLeadership.mutate,
    isTransferring: transferLeadership.isPending,
  };
};

function handleError(error: any, toast: any, isOnline: boolean) {
  if (error.status === 0 || !isOnline) {
    toast.show('You are currently offline.', 'error', 'No Connection');
  } else if (error.status === 401) {
    toast.show('Please log in again.', 'error', 'Session Expired');
  } else if (error.status >= 500) {
    toast.show('An unexpected error occurred.', 'error', 'Server Error');
  } else if (error.message) {
    if (error.message.includes('AUDIENCE_NOT_ELIGIBLE')) {
      toast.show('This student is not eligible for this event.', 'error', 'Not Eligible');
    } else if (error.message.includes('EVENT_LOCKED') || error.message.includes('TEAM_LOCKED')) {
      toast.show('This event is no longer accepting team changes.', 'error', 'Locked');
    } else if (error.message.includes('Invitation expired')) {
      toast.show('Invitation expired.', 'error', 'Expired');
    } else if (error.message.includes('TEAM_MAXIMUM_REACHED')) {
      toast.show('This team is already at its maximum size.', 'error', 'Team Full');
    } else if (error.message.includes('ALREADY_IN_TEAM')) {
      toast.show('You are already part of a team for this event.', 'error', 'Already In Team');
    } else {
      toast.show(error.message, 'error', 'Error');
    }
  } else {
    toast.show('Capacity reached or action invalid.', 'error', 'Action Failed');
  }
}
