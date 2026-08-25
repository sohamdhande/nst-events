import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { apiClient } from '../infrastructure/api';

export interface EventResponse {
  id: string;
  title: string;
  description: string;
  startTime: string;
  endTime: string;
  locationName: string;
  eventType: string;
  visibility: string;
  registrationType: string;
  attendanceType: string;
  state: string;
  maxCapacity: number | null;
  registrationCount: number;
  audience: string;
  metadata: any;
  isLocked?: boolean;
  lockDeadline?: string;
  eventClubs?: Array<{ club: { id: string; name: string } }>;
  audienceBatchIds?: string[];
}

export interface EventsResponse {
  data: EventResponse[];
  pagination: {
    next_cursor: string | null;
    has_more: boolean;
  };
}

export function useEvents() {
  return useInfiniteQuery<EventsResponse, Error>({
    queryKey: ['events'],
    queryFn: ({ pageParam }) => {
      const url = pageParam ? `/v1/events?cursor=${pageParam}` : '/v1/events';
      return apiClient(url);
    },
    initialPageParam: undefined,
    getNextPageParam: (lastPage) => lastPage.pagination.next_cursor || undefined,
    staleTime: 5 * 60 * 1000,
  });
}

export function useEvent(id: string) {
  return useQuery<EventResponse, Error>({
    queryKey: ['events', id],
    queryFn: () => apiClient(`/v1/events/${id}`),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });
}
