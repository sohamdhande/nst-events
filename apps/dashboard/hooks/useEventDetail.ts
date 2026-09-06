import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api';
import { Event } from './useEvents';

export interface EventDetail extends Event {
  description: string;
  eventClubs?: {
    clubId: string;
    isPrimary: boolean;
    club: {
      id: string;
      name: string;
      bannerUrl: string | null;
    };
  }[];
  metadata?: {
    minimum_team_size?: number;
    maximum_team_size?: number;
    agenda?: {
      time: string;
      title: string;
      description?: string;
    }[];
  };
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

export type RegistrationStatus = 'REGISTERED' | 'WAITLISTED' | 'CANCELLED' | 'NOT_REGISTERED';

export interface MyRegistration {
  status: RegistrationStatus;
  team_id?: string | null;
  waitlist_position?: number | null;
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
    queryFn: () => apiClient<MyRegistration>(`/v1/events/${eventId}/my-registration`),
    staleTime: 5 * 60 * 1000,
  });
}
