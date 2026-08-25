import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getWebAuthStore } from '../lib/auth-store';
import { EventDetail } from './useEventDetail';

// Ensure this matches your actual backend URL scheme
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export function useEventLiveUpdates(eventId: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const authStore = getWebAuthStore();
    const token = authStore.accessToken;

    if (!token) return;

    // Do NOT log the tokenized URL to console or telemetry.
    const sseUrl = `${API_BASE_URL}/v1/events/${eventId}/live?token=${token}`;
    const eventSource = new EventSource(sseUrl);

    eventSource.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        
        if (data.type === 'registration_count' && data.payload && typeof data.payload.count === 'number') {
          // Immutably update the query cache, preserving other fields
          queryClient.setQueryData<EventDetail>(['event', eventId], (oldEvent) => {
            if (!oldEvent) return oldEvent;
            return {
              ...oldEvent,
              registrationCount: data.payload.count,
            };
          });
        }
        
        // waitlist_update and heartbeat are acknowledged per contract but require no UX change here.
      } catch (err) {
        // Silent catch for JSON parse errors
      }
    };

    return () => {
      eventSource.close();
    };
  }, [eventId, queryClient]);
}
