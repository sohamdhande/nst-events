import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api';

export interface ClubListItem {
  id: string;
  name: string;
  description: string;
  status: 'ACTIVE' | 'INACTIVE' | 'DISSOLVED';
  banner_url: string | null;
  event_count: number;
  member_count: number;
}

export interface ClubsResponse {
  data: ClubListItem[];
  pagination: {
    next_cursor?: string;
    has_more: boolean;
  };
}

export const useClubs = (query: string = '') => {
  return useQuery<ClubsResponse>({
    queryKey: query ? ['clubs', 'search', query] : ['clubs', 'list'],
    queryFn: () => {
      if (query) {
        return apiClient<ClubsResponse>(`/clubs/search?q=${encodeURIComponent(query)}`);
      }
      return apiClient<ClubsResponse>('/clubs');
    },
    staleTime: 10 * 60 * 1000, // 10 minutes from clubs.md
  });
};
