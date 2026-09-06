import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
  below_minimum?: boolean;
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

export function useTeamLookup(teamId?: string | null) {
  return useQuery<Team, Error>({
    queryKey: ['team', teamId],
    queryFn: () => apiClient<Team>(`/v1/teams/${teamId}`),
    enabled: !!teamId,
  });
}

export function useJoinTeam(eventId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (teamId: string) => apiClient(`/v1/teams/${teamId}/join`, { method: 'POST' }),
    onSuccess: (data, teamId) => {
      queryClient.setQueryData(['event-my-registration', eventId], (old: any) => old ? { ...old, team_id: teamId } : old);
      queryClient.invalidateQueries({ queryKey: ['event-my-registration', eventId] });
      queryClient.invalidateQueries({ queryKey: ['event-teams', eventId] });
      queryClient.invalidateQueries({ queryKey: ['event', eventId] });
      queryClient.invalidateQueries({ queryKey: ['my-registrations'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      queryClient.invalidateQueries({ queryKey: ['team', teamId] });
    },
  });
}

export function useLeaveTeam(eventId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (teamId: string) => apiClient(`/v1/teams/${teamId}/leave`, { method: 'DELETE' }),
    onSuccess: (_, teamId) => {
      queryClient.setQueryData(['event-my-registration', eventId], (old: any) => old ? { ...old, team_id: null } : old);
      queryClient.invalidateQueries({ queryKey: ['event-my-registration', eventId] });
      queryClient.invalidateQueries({ queryKey: ['event-teams', eventId] });
      queryClient.invalidateQueries({ queryKey: ['event', eventId] });
      queryClient.invalidateQueries({ queryKey: ['my-registrations'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      queryClient.invalidateQueries({ queryKey: ['team', teamId] });
    },
  });
}

export interface CreateTeamResponse {
  team_id: string;
  name: string;
  leader_id: string;
  status: string;
  registration_id: string;
}

export function useCreateTeam(eventId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { name: string }) => apiClient<CreateTeamResponse>(`/v1/events/${eventId}/teams`, { method: 'POST', body: JSON.stringify({ team_name: data.name }) }),
    onSuccess: (data) => {
      queryClient.setQueryData(['event-my-registration', eventId], (old: any) => old ? { ...old, team_id: data.team_id } : old);
      queryClient.invalidateQueries({ queryKey: ['event-my-registration', eventId] });
      queryClient.invalidateQueries({ queryKey: ['event-teams', eventId] });
      queryClient.invalidateQueries({ queryKey: ['event', eventId] });
      queryClient.invalidateQueries({ queryKey: ['my-registrations'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      queryClient.invalidateQueries({ queryKey: ['team', data.team_id] });
    },
  });
}

export function useTransferLeadership(eventId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ teamId, newLeaderId }: { teamId: string; newLeaderId: string }) => 
      apiClient(`/v1/teams/${teamId}/transfer-leadership`, { method: 'POST', body: JSON.stringify({ new_leader_id: newLeaderId }) }),
    onSuccess: (_, { teamId }) => {
      queryClient.invalidateQueries({ queryKey: ['team', teamId] });
      queryClient.invalidateQueries({ queryKey: ['event-teams', eventId] });
    },
  });
}
