import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api';

export interface UpdateEventInput {
  title?: string;
  description?: string;
  start_time?: string;
  end_time?: string;
  location_name?: string;
  location_lat?: number;
  location_lng?: number;
  event_type?: string;
  visibility?: 'PUBLIC' | 'PRIVATE';
  registration_type?: 'INDIVIDUAL' | 'TEAM';
  attendance_type?: 'SINGLE' | 'MULTI_SESSION';
  audience?: 'ALL_STUDENTS' | 'SPECIFIC_BATCHES';
  audience_batch_ids?: string[];
  max_capacity?: number | null;
  metadata?: Record<string, unknown>;
}

export function useUpdateEvent(eventId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateEventInput) => {
      return apiClient(`/v1/events/${eventId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event', eventId] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
    },
  });
}
