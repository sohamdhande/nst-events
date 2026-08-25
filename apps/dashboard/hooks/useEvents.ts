import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api';

export interface Event {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  locationName: string | null;
  state: string;
  maxCapacity: number | null;
  registrationCount: number;
  isLocked: boolean;
  attendanceType: 'SINGLE' | 'MULTI_SESSION';
  eventType: 'HACKATHON' | 'WORKSHOP' | 'SEMINAR' | 'SOCIAL' | 'COMPETITION' | 'OTHER';
  visibility: 'PUBLIC' | 'PRIVATE' | 'UNLISTED';
  registrationType: 'INDIVIDUAL' | 'TEAM';
  audience: 'ALL_STUDENTS' | 'SPECIFIC_BATCHES';
  audienceBatchIds?: string[];
  lock_deadline: string;
  below_minimum_team_count?: number;
  metadata?: Record<string, unknown>;
  eventClubs?: { clubId: string; isPrimary: boolean; club: { id: string; name: string } }[];
}

export interface EventsResponse {
  data: Event[];
  pagination: {
    next_cursor?: string;
    has_more: boolean;
  };
}

export interface EventsQueryParams {
  q?: string;
  filter_state?: string;
  filter_club_id?: string;
  limit?: number;
  cursor?: string;
}

export function useEvents(params?: EventsQueryParams) {
  return useQuery<EventsResponse>({
    queryKey: ['events', 'list', params],
    queryFn: () => {
      const searchParams = new URLSearchParams();
      searchParams.set('limit', (params?.limit || 20).toString());
      if (params?.q) searchParams.set('q', params.q);
      if (params?.filter_state) searchParams.set('filter_state', params.filter_state);
      if (params?.filter_club_id) searchParams.set('filter_club_id', params.filter_club_id);
      if (params?.cursor) searchParams.set('cursor', params.cursor);

      return apiClient<EventsResponse>(`/v1/events?${searchParams.toString()}`);
    },
  });
}
