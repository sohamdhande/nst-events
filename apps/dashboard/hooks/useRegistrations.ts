import { useInfiniteQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api';

export interface RegistrationUser {
  id: string;
  fullName: string | null;
  email: string;
  globalRole: string;
}

export interface Registration {
  id: string;
  eventId: string;
  userId: string;
  registrationStatus: 'REGISTERED' | 'WAITLISTED' | 'CANCELLED';
  registeredAt: string;
  user: RegistrationUser;
}

export interface RegistrationsResponse {
  data: Registration[];
  pagination: {
    next_cursor: string | null;
    has_more: boolean;
  };
}

export function useRegistrationsList(eventId: string, filterStatus?: string) {
  return useInfiniteQuery<RegistrationsResponse, Error>({
    queryKey: ['registrations', eventId, filterStatus],
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({ limit: '20' });
      if (pageParam) params.append('cursor', pageParam as string);
      if (filterStatus) params.append('filter_status', filterStatus);
      
      return apiClient<RegistrationsResponse>(`/v1/events/${eventId}/registrations?${params.toString()}`);
    },
    initialPageParam: null,
    getNextPageParam: (lastPage) => lastPage.pagination.next_cursor,
    enabled: !!eventId,
  });
}
