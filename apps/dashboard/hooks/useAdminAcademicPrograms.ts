import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api';

export interface AdminAcademicProgram {
  id: string;
  name: string;
  code: string;
  batchCount: number;
}

export function useAdminAcademicPrograms() {
  const queryClient = useQueryClient();

  const query = useQuery<AdminAcademicProgram[]>({
    queryKey: ['admin-academic-programs'],
    queryFn: () => apiClient<AdminAcademicProgram[]>('/v1/academic-programs'),
  });

  const createProgram = useMutation({
    mutationFn: (data: { name: string; code: string }) =>
      apiClient<AdminAcademicProgram>('/v1/admin/academic-programs', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-academic-programs'] });
    },
  });

  const updateProgram = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name?: string; code?: string } }) =>
      apiClient<AdminAcademicProgram>(`/v1/admin/academic-programs/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-academic-programs'] });
    },
  });

  return {
    ...query,
    createProgram,
    updateProgram,
  };
}
