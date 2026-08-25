import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api';
import { getWebAuthStore } from '../lib/auth-store';


export interface ClubMembership {
  club_id: string;
  club_name: string;
  role: string;
}

export interface CurrentUser {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  global_role: 'STUDENT' | 'FACULTY_ADMIN' | 'PLATFORM_ADMIN';
  club_memberships: ClubMembership[];
}

export function useCurrentUser() {
  const authStore = getWebAuthStore();
  const isAuthenticated = !!authStore.accessToken;

  return useQuery<CurrentUser>({
    queryKey: ['users', 'me'],
    queryFn: () => apiClient<CurrentUser>('/users/me'),
    enabled: isAuthenticated, // Only fetch if authenticated
    staleTime: 5 * 60 * 1000,
  });
}
