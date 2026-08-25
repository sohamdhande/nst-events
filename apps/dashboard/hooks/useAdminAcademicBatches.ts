import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api';
import { AcademicBatch } from './useAcademicBatches';

export function useAdminAcademicBatches() {
  const queryClient = useQueryClient();

  const query = useQuery<AcademicBatch[]>({
    queryKey: ['admin-academic-batches'],
    queryFn: () => apiClient<AcademicBatch[]>('/v1/academic-batches'),
  });

  const createBatch = useMutation({
    mutationFn: (data: { program_id: string; admission_year: number; graduation_year: number }) => 
      apiClient<AcademicBatch>('/v1/admin/academic-batches', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-academic-batches'] });
      queryClient.invalidateQueries({ queryKey: ['academic-batches'] });
    },
  });

  const updateBatch = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { admission_year?: number; graduation_year?: number } }) => 
      apiClient<AcademicBatch>(`/v1/admin/academic-batches/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-academic-batches'] });
      queryClient.invalidateQueries({ queryKey: ['academic-batches'] });
    },
  });

  return {
    ...query,
    createBatch,
    updateBatch,
  };
}
