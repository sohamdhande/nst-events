import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api';

export interface LeaderboardStudent {
  user_id: string;
  display_name: string;
  total_points: number;
}

export function useClubStudentLeaderboard(clubId?: string) {
  return useQuery<{ data: LeaderboardStudent[] }>({
    queryKey: ['club-leaderboard', 'students', clubId],
    queryFn: () => apiClient<{ data: LeaderboardStudent[] }>(`/v1/leaderboard/clubs/${clubId}/students`),
    enabled: !!clubId,
  });
}

export function useRecalculateLeaderboard() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: () => {
      return apiClient<{ message: string }>(`/v1/admin/leaderboard/recalculate`, {
        method: 'POST',
      });
    },
    onSuccess: () => {
      // Invalidate any queries related to leaderboard if they exist
      queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
      queryClient.invalidateQueries({ queryKey: ['club-leaderboard'] });
    },
  });
}
