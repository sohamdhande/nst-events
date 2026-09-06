import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api';

export interface LeaderboardStudent {
  rank: number;
  user_id: string;
  display_name: string;
  total_points: number;
}

export interface LeaderboardClub {
  rank: number;
  club_id: string;
  club_name: string;
  total_points: number;
  event_count: number;
  member_count: number;
}

export interface MyRankResponse {
  rank: number | null;
  total_points: number;
}

export interface LeaderboardResponse<T> {
  data: T[];
  nextCursor?: string;
}

export function useMyRank() {
  return useQuery<MyRankResponse>({
    queryKey: ['leaderboard', 'me'],
    queryFn: () => apiClient<MyRankResponse>('/v1/leaderboard/me'),
  });
}

export function useGlobalStudentLeaderboard() {
  return useInfiniteQuery<LeaderboardResponse<LeaderboardStudent>, Error>({
    queryKey: ['leaderboard', 'global', 'students'],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => {
      const cursorStr = pageParam ? `?cursor=${pageParam}&limit=20` : '?limit=20';
      return apiClient<LeaderboardResponse<LeaderboardStudent>>(`/v1/leaderboard/students${cursorStr}`);
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });
}

export function useGlobalClubLeaderboard() {
  return useInfiniteQuery<LeaderboardResponse<LeaderboardClub>, Error>({
    queryKey: ['leaderboard', 'global', 'clubs'],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => {
      const cursorStr = pageParam ? `?cursor=${pageParam}&limit=20` : '?limit=20';
      return apiClient<LeaderboardResponse<LeaderboardClub>>(`/v1/leaderboard/clubs${cursorStr}`);
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });
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
