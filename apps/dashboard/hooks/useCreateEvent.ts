import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api';
import { Event } from './useEvents';

export interface CreateEventPayload {
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
  location_name?: string;
  location_lat?: number;
  location_lng?: number;
  event_type: string;
  visibility: string;
  registration_type: string;
  attendance_type: string;
  audience?: 'ALL_STUDENTS' | 'SPECIFIC_BATCHES';
  audience_batch_ids?: string[];
  max_capacity?: number;
  club_ids: { club_id: string; is_primary: boolean }[];
  metadata?: Record<string, unknown>;
}

export function useCreateEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateEventPayload) => apiClient<Event>('/v1/events', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
    },
  });
}

export function useSubmitEventForApproval() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (eventId: string) => apiClient<{ state: string }>(`/v1/events/${eventId}/submit-for-approval`, {
      method: 'POST',
    }),
    onSuccess: (_, eventId) => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['events', eventId] });
    },
  });
}
