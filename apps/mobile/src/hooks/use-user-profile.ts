import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../infrastructure/api';

export interface ClubMembershipItem {
  club_id: string;
  club_name: string;
  role: string;
}

export interface AcademicProfileItem {
  batch: {
    id: string;
    program: {
      id: string;
      name: string;
      code: string;
    };
    admission_year: number;
    graduation_year: number;
  };
  assignment_source: string;
}

export interface UserProfileResponse {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  global_role: 'STUDENT' | 'FACULTY_ADMIN' | 'PLATFORM_ADMIN' | 'FACULTY_MENTOR';
  club_memberships: ClubMembershipItem[];
  academic_profile: AcademicProfileItem | null;
}

export function useUserProfile() {
  return useQuery<UserProfileResponse, Error>({
    queryKey: ['user-profile'],
    queryFn: () => apiClient('/users/me'),
    staleTime: 5 * 60 * 1000,
  });
}
