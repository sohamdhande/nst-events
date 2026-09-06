import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { apiClient } from '../infrastructure/api';

export type AttendanceMethod = 'QR' | 'MANUAL' | 'SYSTEM';
export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'EXCUSED';

export interface AttendanceRecordItem {
  id: string;
  sessionId: string;
  userId: string;
  markedBy: string | null;
  markedAt: string;
  method: AttendanceMethod;
  status: AttendanceStatus;
  auditMetadata: Record<string, unknown> | null;
  session?: {
    id: string;
    title: string;
    eventId: string;
    startTime: string;
    endTime: string;
    openAt: string;
    closeAt: string;
    event?: {
      title: string;
    };
  };
}

export interface AttendanceHistoryResponse {
  data: AttendanceRecordItem[];
  nextCursor?: string | null;
}

export function useAttendanceHistory(eventId?: string) {
  return useInfiniteQuery<AttendanceHistoryResponse, Error>({
    queryKey: ['my-attendance', eventId],
    queryFn: ({ pageParam }) => {
      const cursorParam = pageParam ? `&cursor=${pageParam}` : '';
      const eventParam = eventId ? `&filter_event_id=${eventId}` : '';
      return apiClient(`/v1/users/me/attendance?limit=20${eventParam}${cursorParam}`);
    },
    initialPageParam: undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor || undefined,
    staleTime: 2 * 60 * 1000,
  });
}

export function useAttendanceRecord(id: string) {
  const { data } = useAttendanceHistory();
  const allRecords = data?.pages.flatMap((page) => page.data) || [];
  const record = allRecords.find((r) => r.id === id);

  return {
    record,
    isLoading: !data,
  };
}
