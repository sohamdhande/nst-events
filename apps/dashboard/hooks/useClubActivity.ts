import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api';

export interface ClubActivityItem {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  created_at: string;
  actor_name: string;
}

export function useClubActivity(clubId?: string) {
  return useQuery<ClubActivityItem[]>({
    queryKey: ['club-activity', clubId],
    queryFn: () => apiClient<ClubActivityItem[]>(`/v1/clubs/${clubId}/activity`),
    enabled: !!clubId,
  });
}
