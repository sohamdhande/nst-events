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

export function useMyAttendance(eventId?: string) {
  return useInfiniteQuery<AttendanceResponse>({
    queryKey: ['my-attendance', eventId],
    queryFn: async ({ pageParam = undefined }) => {
      const cursorParam = pageParam ? `&cursor=${pageParam}` : '';
      const eventParam = eventId ? `&filter_event_id=${eventId}` : '';
      return apiClient<AttendanceResponse>(`/v1/users/me/attendance?limit=20${cursorParam}${eventParam}`);
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

export interface AttendanceDispute {
  id: string;
  attendanceRecordId: string | null;
  sessionId: string;
  eventId: string;
  userId: string;
  reason: string;
  evidenceUrls: string[];
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  disputeWindowExpiresAt: string;
  submittedAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
  reviewNotes: string | null;
  createdAt: string;
  user: {
    id: string;
    fullName: string | null;
  };
}

export interface AttendanceDisputesResponse {
  data: AttendanceDispute[];
  nextCursor?: string | null;
}

export function useAttendanceDisputes(eventId?: string, clubId?: string) {
  return useInfiniteQuery<AttendanceDisputesResponse>({
    queryKey: ['attendance-disputes', eventId, clubId],
    queryFn: async ({ pageParam = undefined }) => {
      const cursorParam = pageParam ? `&cursor=${pageParam}` : '';
      const eventParam = eventId ? `&filter_event_id=${eventId}` : '';
      const clubParam = clubId ? `&filter_club_id=${clubId}` : '';
      return apiClient<AttendanceDisputesResponse>(`/v1/attendance/disputes?limit=20${eventParam}${clubParam}${cursorParam}`);
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor || undefined,
    initialPageParam: undefined,
  });
}

export function useResolveAttendanceDispute(eventId?: string, clubId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, resolution, review_notes }: { id: string; resolution: 'APPROVED' | 'REJECTED'; review_notes?: string }) => {
      return apiClient(`/v1/attendance/disputes/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ resolution, review_notes })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance-disputes', eventId, clubId] });
      if (eventId) {
        queryClient.invalidateQueries({ queryKey: ['attendance', eventId] });
        queryClient.invalidateQueries({ queryKey: ['event', eventId] });
      }
      if (clubId) {
        queryClient.invalidateQueries({ queryKey: ['club-analytics', clubId] });
        queryClient.invalidateQueries({ queryKey: ['club-leaderboard', 'students', clubId] });
      }
    }
  });
}

export function useSubmitAttendanceDispute(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { session_id: string; reason: string; evidence_urls?: string[] }) => {
      return apiClient(`/v1/attendance/disputes`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance-disputes', eventId] });
      queryClient.invalidateQueries({ queryKey: ['event', eventId] });
    }
  });
}
