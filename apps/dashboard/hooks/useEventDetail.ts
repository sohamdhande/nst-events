import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api';
import { Event } from './useEvents';

export interface EventDetail extends Event {
  description: string;
  attendanceSessions?: {
    id: string;
    eventId: string;
    title: string | null;
    startTime: string | null;
    endTime: string | null;
    openAt: string | null;
    closeAt: string | null;
  }[];
}

export type RegistrationStatus = 'REGISTERED' | 'WAITLISTED' | 'CANCELLED' | 'UNREGISTERED';

export interface MyRegistration {
  status: RegistrationStatus;
}

export function useEventDetail(eventId: string) {
  return useQuery<EventDetail>({
    queryKey: ['event', eventId],
    queryFn: () => apiClient<EventDetail>(`/v1/events/${eventId}`),
    staleTime: 5 * 60 * 1000,
  });
}

export function useMyRegistration(eventId: string) {
  return useQuery<MyRegistration>({
    queryKey: ['event-my-registration', eventId],
    queryFn: async () => {
      try {
        const data = await apiClient<{ status: RegistrationStatus }>(`/v1/events/${eventId}/my-registration`);
        return data;
      } catch (err: unknown) {
        // DATA_CONTRACT.md explicitly defines 404 as "not registered" for this endpoint
        if (err instanceof Error && err.message.includes('404')) {
          return { status: 'UNREGISTERED' };
        }
        throw err;
      }
    },
    staleTime: 5 * 60 * 1000,
  });
}
