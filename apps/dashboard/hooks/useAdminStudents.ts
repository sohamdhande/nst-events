import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api';

export interface AuthorizedStudent {
  id: string;
  normalizedEmail: string;
  status: 'ACTIVE' | 'REVOKED';
  createdAt: string;
  user?: {
    id: string;
    fullName: string;
    academicProfile?: {
      batch?: {
        admissionYear: number;
        graduationYear: number;
        program: { name: string; code: string };
      };
    };
  } | null;
}

export function useAdminStudents(q?: string, status?: string) {
  return useQuery({
    queryKey: ['adminStudents', q, status],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      if (status) params.set('status', status);
      
      const response = await apiClient<{ data: AuthorizedStudent[]; pagination: any }>(`/v1/admin/students?${params.toString()}`);
      return response;
    },
  });
}

export function useAddStudent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (email: string) => {
      return apiClient('/v1/admin/students', {
        method: 'POST',
        body: JSON.stringify({ email })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminStudents'] });
    },
  });
}

export function useRemoveStudent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      return apiClient(`/v1/admin/students/${id}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminStudents'] });
    },
  });
}

export function useImportStudents() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      
      // We must omit Content-Type so fetch sets it automatically with the boundary
      return apiClient('/v1/admin/students/import', {
        method: 'POST',
        body: formData,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminStudents'] });
    },
  });
}
