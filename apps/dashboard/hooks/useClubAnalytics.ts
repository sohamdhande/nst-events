import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api';

export interface ClubAnalyticsResponse {
  total_events: number;
  total_registrations: number;
  total_attendance: number;
  unique_attendees: number;
  attendance_rate: number;
  pipeline_counts: Record<string, number>;
}

export function useClubAnalytics(clubId?: string) {
  return useQuery<ClubAnalyticsResponse>({
    queryKey: ['club-analytics', clubId],
    queryFn: () => apiClient<ClubAnalyticsResponse>(`/v1/clubs/${clubId}/analytics`),
    enabled: !!clubId,
  });
}
