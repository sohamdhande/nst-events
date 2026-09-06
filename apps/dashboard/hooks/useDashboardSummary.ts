import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api';

export interface UpcomingEvent {
  id: string;
  title: string;
  start_time: string;
}

export interface PendingApproval {
  id: string;
  title: string;
}

export interface MyClubSummary {
  id: string;
  name: string;
  member_count: number;
}

export interface DashboardSummaryResponse {
  totalPoints: number;
  eventsAttendedCount: number;
  upcoming_events: UpcomingEvent[];
  pending_approvals: PendingApproval[];
  my_clubs: MyClubSummary[];
}

export function useDashboardSummary() {
  return useQuery<DashboardSummaryResponse>({
    queryKey: ['dashboard', 'summary'],
    queryFn: () => apiClient<DashboardSummaryResponse>('/v1/dashboard/summary'),
  });
}
