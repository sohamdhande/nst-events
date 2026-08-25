import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api';

export interface AttendanceRecord {
  id: string;
  sessionId: string;
  userId: string;
  markedBy: string | null;
  markedAt: string;
  method: 'QR' | 'MANUAL' | 'SYSTEM' | 'OFFLINE';
  status: 'PRESENT' | 'ABSENT' | 'EXCUSED';
  auditMetadata: Record<string, unknown> | null;
  user?: {
    id: string;
    fullName: string | null;
    email: string;
  };
}

export interface AttendanceResponse {
  data: AttendanceRecord[];
  nextCursor?: string | null;
}

export function useAttendance(eventId: string, sessionId?: string) {
  return useInfiniteQuery<AttendanceResponse>({
    queryKey: ['attendance', eventId, sessionId],
    queryFn: async ({ pageParam = undefined }) => {
      const cursorParam = pageParam ? `&cursor=${pageParam}` : '';
      const sessionParam = sessionId ? `&filter_session_id=${sessionId}` : '';
      return apiClient<AttendanceResponse>(`/v1/events/${eventId}/attendance?limit=20${cursorParam}${sessionParam}`);
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor || undefined,
    initialPageParam: undefined,
  });
}

export function useGenerateQr() {
  return useMutation({
    retry: false, // We handle retries manually with 429-aware backoff in the page
    mutationFn: async (sessionId: string) => {
      return apiClient<{ qr_payload: string; expires_at: string }>(`/v1/attendance/generate-qr`, {
        method: 'POST',
        body: JSON.stringify({ session_id: sessionId })
      });
    }
  });
}

export function useCreateSession(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { title: string; start_time: string; end_time: string; open_at: string; close_at: string; geofence_radius: number }) => {
      return apiClient(`/v1/events/${eventId}/sessions`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event', eventId] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
    }
  });
}

export function useUpdateSession(eventId: string, sessionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { close_at: string }) => {
      return apiClient(`/v1/events/${eventId}/sessions/${sessionId}`, {
        method: 'PATCH',
        body: JSON.stringify(payload)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event', eventId] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['attendance', eventId, sessionId] });
    }
  });
}

export function useManualAttendance(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { session_id: string; user_id: string }) => {
      return apiClient(`/v1/events/${eventId}/attendance/manual`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['attendance', eventId, variables.session_id] });
      queryClient.invalidateQueries({ queryKey: ['event', eventId] });
    }
  });
}
