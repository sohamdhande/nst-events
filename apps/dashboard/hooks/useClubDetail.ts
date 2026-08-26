import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api';

export type ClubRole = 'CLUB_ADMIN' | 'MEMBER' | 'FACULTY_MENTOR' | 'CORE_MEMBER';

export interface ClubMember {
  user_id: string;
  role: ClubRole;
  full_name: string;
  avatar_url: string | null;
}

export interface ClubDetailResponse {
  id: string;
  name: string;
  description: string | null;
  banner_url: string | null;
  status: 'ACTIVE' | 'INACTIVE' | 'DISSOLVED';
  event_count: number;
  members: ClubMember[];
}

export const useClubDetail = (clubId: string) => {
  return useQuery<ClubDetailResponse>({
    queryKey: ['clubs', 'detail', clubId],
    queryFn: () => apiClient<ClubDetailResponse>(`/clubs/${clubId}`),
    enabled: !!clubId,
  });
};

export interface AddClubMemberRequest {
  user_id: string;
  role: ClubRole;
}

export const useAddClubMember = (clubId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: AddClubMemberRequest) =>
      apiClient(`/clubs/${clubId}/members`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clubs', 'detail', clubId] });
      queryClient.invalidateQueries({ queryKey: ['clubs', 'list'] });
    },
  });
};

export interface UpdateClubMemberRoleRequest {
  role: ClubRole;
}

export const useUpdateClubMemberRole = (clubId: string, userId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateClubMemberRoleRequest) =>
      apiClient(`/clubs/${clubId}/members/${userId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clubs', 'detail', clubId] });
      queryClient.invalidateQueries({ queryKey: ['clubs', 'list'] });
    },
  });
};

export const useRemoveClubMember = (clubId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: string) =>
      apiClient(`/clubs/${clubId}/members/${userId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clubs', 'detail', clubId] });
      queryClient.invalidateQueries({ queryKey: ['clubs', 'list'] });
    },
  });
};
