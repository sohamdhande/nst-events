import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api';

export interface AcademicProgram {
  id: string;
  name: string;
  code: string;
}

export interface AcademicBatch {
  id: string;
  program: AcademicProgram;
  admission_year: number;
  graduation_year: number;
  display_name: string;
}

export function useAcademicBatches() {
  return useQuery<AcademicBatch[]>({
    queryKey: ['academic-batches'],
    queryFn: () => apiClient<AcademicBatch[]>('/v1/academic-batches'),
    staleTime: 60 * 60 * 1000, // Cache for 1 hour since catalogs change rarely
  });
}
