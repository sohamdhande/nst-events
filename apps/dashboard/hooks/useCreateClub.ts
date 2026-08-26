import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api';

export interface CreateClubPayload {
  name: string;
  description?: string;
  initial_admin_id: string;
  banner_url?: string | null;
}

export interface CreateClubResponse {
  id: string;
  name: string;
  status: string;
}

export function useCreateClub() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateClubPayload) => {
      return apiClient<CreateClubResponse>('/clubs', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      // Invalidate the clubs list and search queries
      queryClient.invalidateQueries({ queryKey: ['clubs'] });
    },
  });
}
