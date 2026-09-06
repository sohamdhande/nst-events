import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api';
import { Event } from './useEvents'; // Reusing Event type if available

export interface MyRegistration {
  id: string;
  eventId: string;
  registrationStatus: 'REGISTERED' | 'WAITLISTED' | 'CANCELLED';
  participationRole: string;
  registeredAt: string;
  cancelledAt: string | null;
  event: any; // We can use the Event shape from DATA_CONTRACT
  team: {
    id: string;
    name: string;
    leaderId: string;
    status: string;
    memberCount: number;
  } | null;
}

export function useMyRegistrations() {
  return useQuery<MyRegistration[]>({
    queryKey: ['my-registrations'],
    queryFn: () => apiClient<MyRegistration[]>('/v1/users/me/registrations'),
  });
}
