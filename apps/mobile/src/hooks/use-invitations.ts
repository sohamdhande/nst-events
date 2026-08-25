import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../infrastructure/api';

export interface PendingInvitation {
  invitation_id: string;
  status: string;
  created_at: string;
  expires_at: string;
  team: {
    team_id: string;
    team_name: string;
    leader_id: string;
  };
  event: {
    event_id: string;
    event_title: string;
  };
  inviter: {
    user_id: string;
    full_name: string;
  };
}

export function usePendingInvitations() {
  return useQuery<PendingInvitation[]>({
    queryKey: ['invitations'],
    queryFn: () => apiClient('/v1/users/me/team-invitations'),
  });
}

export function useSentInvitations(eventId: string, teamId: string) {
  return useQuery<PendingInvitation[]>({
    queryKey: ['sent-invitations', teamId],
    queryFn: () => apiClient(`/v1/events/${eventId}/teams/${teamId}/invitations`),
    enabled: !!eventId && !!teamId,
  });
}

export interface InviteeSearchResult {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
}

export function useSearchInvitees(eventId: string, query: string) {
  return useQuery<InviteeSearchResult[]>({
    queryKey: ['invitees', eventId, query],
    queryFn: async () => {
      if (!query || query.length < 2) return [];
      const params = new URLSearchParams({ q: query });
      return apiClient(`/v1/events/${eventId}/invitee-search?${params.toString()}`);
    },
    enabled: !!eventId && query.length >= 2,
    staleTime: 60 * 1000, // 1 minute
  });
}
