import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api';

export interface TeamMember {
  user_id: string;
  full_name: string;
  registration_status: string;
}

export interface Team {
  id: string;
  name: string;
  leader_id: string;
  leader_name: string;
  member_count: number;
  status?: string;
  members: TeamMember[];
}

export interface TeamsResponse {
  data: Team[];
  pagination: {
    next_cursor: string | null;
    has_more: boolean;
  };
}

export function useTeamsList(eventId: string) {
  return useInfiniteQuery<TeamsResponse, Error>({
    queryKey: ['event-teams', eventId],
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({ limit: '20' });
      if (pageParam) params.append('cursor', pageParam as string);
      return apiClient<TeamsResponse>(`/v1/events/${eventId}/teams?${params.toString()}`);
    },
    initialPageParam: null,
    getNextPageParam: (lastPage) => lastPage.pagination.next_cursor,
    enabled: !!eventId,
  });
}

export function useJoinTeam(eventId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (teamId: string) => apiClient(`/v1/teams/${teamId}/join`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-teams', eventId] });
      queryClient.invalidateQueries({ queryKey: ['event', eventId] });
    },
  });
}

export function useLeaveTeam(eventId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (teamId: string) => apiClient(`/v1/teams/${teamId}/leave`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-teams', eventId] });
      queryClient.invalidateQueries({ queryKey: ['event', eventId] });
    },
  });
}
