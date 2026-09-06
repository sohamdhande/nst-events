import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../infrastructure/api';

export type DisputeStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface AttendanceDisputeItem {
  id: string;
  attendanceRecordId: string | null;
  sessionId: string;
  eventId: string;
  userId: string;
  reason: string;
  evidenceUrls: string[] | null;
  status: DisputeStatus;
  disputeWindowExpiresAt: string;
  submittedAt?: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
  reviewNotes: string | null;
  createdAt: string;
  user?: {
    id: string;
    fullName: string | null;
  };
  session?: {
    id: string;
    title: string;
    event?: {
      title: string;
    };
  };
}

export interface AttendanceDisputesResponse {
  data: AttendanceDisputeItem[];
  nextCursor?: string | null;
}

export function useMyDisputes(eventId?: string) {
  return useInfiniteQuery<AttendanceDisputesResponse, Error>({
    queryKey: ['my-disputes', eventId],
    queryFn: ({ pageParam }) => {
      const cursorParam = pageParam ? `&cursor=${pageParam}` : '';
      const eventParam = eventId ? `&filter_event_id=${eventId}` : '';
      return apiClient(`/v1/attendance/disputes?limit=20${eventParam}${cursorParam}`);
    },
    initialPageParam: undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor || undefined,
    staleTime: 2 * 60 * 1000,
  });
}

export function useDisputeDetail(id: string) {
  const { data, isLoading } = useMyDisputes();
  const allDisputes = data?.pages.flatMap((page) => page.data) || [];
  const dispute = allDisputes.find((d) => d.id === id);

  return {
    dispute,
    isLoading,
  };
}

export interface SubmitDisputePayload {
  session_id: string;
  reason: string;
  evidence_urls?: string[];
}

export function useSubmitDispute() {
  const queryClient = useQueryClient();

  return useMutation<AttendanceDisputeItem, Error, SubmitDisputePayload>({
    mutationFn: (payload: SubmitDisputePayload) => {
      return apiClient('/v1/attendance/disputes', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-disputes'] });
      queryClient.invalidateQueries({ queryKey: ['my-attendance'] });
    },
  });
}
