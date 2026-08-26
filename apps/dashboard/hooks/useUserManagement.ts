import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api';

export interface AdminUser {
  id: string;
  email: string;
  fullName: string | null;
  globalRole: 'STUDENT' | 'FACULTY_MENTOR' | 'FACULTY_ADMIN' | 'PLATFORM_ADMIN';
  academicProfile?: {
    batchId: string;
    assignmentSource: 'EMAIL_INFERENCE' | 'ADMIN';
    assignedAt: string;
    batch: {
      id: string;
      programId: string;
      admissionYear: number;
      graduationYear: number;
      program: {
        id: string;
        name: string;
        code: string;
      };
    };
  } | null;
  clubMemberships?: Array<{
    id: string;
    role: string;
    club: { id: string; name: string };
  }>;
}

export interface AdminUsersResponse {
  data: AdminUser[];
  pagination: {
    next_cursor: string | null;
  };
  platform_admin_count?: number;
}

export interface UpdateRolePayload {
  role: 'STUDENT' | 'FACULTY_MENTOR' | 'FACULTY_ADMIN' | 'PLATFORM_ADMIN';
}

export function useAdminUsers(q?: string, scope?: string) {
  return useInfiniteQuery<AdminUsersResponse>({
    queryKey: ['admin-users', q, scope],
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams();
      params.set('limit', '20'); // Documented limit behavior, we will use a reasonable default. Wait, what is the default limit? Let's use 20.
      if (q) params.set('q', q);
      if (pageParam) params.set('cursor', pageParam as string);
      if (scope) params.set('scope', scope);
      
      return apiClient<AdminUsersResponse>(`/v1/admin/users?${params.toString()}`);
    },
    getNextPageParam: (lastPage) => lastPage.pagination.next_cursor || undefined,
    initialPageParam: undefined,
  });
}

export function useUpdateUserRole() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ userId, payload }: { userId: string; payload: UpdateRolePayload }) => {
      return apiClient<AdminUser>(`/v1/admin/users/${userId}/role`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      // Only invalidate the exact documented query key
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-user-detail'] });
    },
  });
}

export function useUpdateUserAcademicBatch() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ userId, batchId }: { userId: string; batchId: string }) => {
      return apiClient<AdminUser>(`/v1/admin/users/${userId}/academic-batch`, {
        method: 'PATCH',
        body: JSON.stringify({ batchId }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-user-detail'] });
    },
  });
}

export function useAdminUserDetail(userId: string) {
  return useQuery({
    queryKey: ['admin-user-detail', userId],
    queryFn: () => apiClient<AdminUser & { clubMemberships?: any[] }>(`/v1/admin/users/${userId}`),
    enabled: !!userId,
  });
}

export function useProvisionUser() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (payload: { email: string; globalRole?: 'STUDENT' | 'FACULTY_MENTOR' | 'FACULTY_ADMIN' | 'PLATFORM_ADMIN'; clubId?: string; clubRole?: 'CLUB_ADMIN' }) => {
      return apiClient<AdminUser>(`/v1/admin/users/provision`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
  });
}
