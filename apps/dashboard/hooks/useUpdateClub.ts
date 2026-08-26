import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api';

export interface UpdateClubPayload {
  name?: string;
  description?: string | null;
  banner_url?: string | null;
}

export interface ClubUpdateResponse {
  id: string;
  name: string;
  description: string | null;
  banner_url: string | null;
  status: string;
  event_count: number;
}

export const useUpdateClub = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: UpdateClubPayload }) => {
      const data = await apiClient<ClubUpdateResponse>(`/clubs/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      return data;
    },
    onSuccess: (data) => {
      // Invalidate the clubs list query to refetch data from server
      queryClient.invalidateQueries({ queryKey: ['clubs'] });
      // If there is a club-detail query in the future, it would be invalidated here too:
      queryClient.invalidateQueries({ queryKey: ['clubs', 'detail', data.id] });
    },
  });
};

export interface UpdateClubStatusPayload {
  status: 'ACTIVE' | 'INACTIVE' | 'DISSOLVED';
}

export const useUpdateClubStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: UpdateClubStatusPayload }) => {
      const data = await apiClient<ClubUpdateResponse>(`/clubs/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['clubs'] });
      queryClient.invalidateQueries({ queryKey: ['clubs', 'detail', data.id] });
    },
  });
};
