import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { SSEManager } from '../sse/manager';
import { useAuthStore } from '../store/auth';
import { useToast } from './use-toast';
import { useNetworkStatus } from '../infrastructure/network';

// Singleton registry to prevent multiple EventSource connections per event
const sseManagers = new Map<string, SSEManager>();

export const useEventLive = (eventId: string) => {
  const queryClient = useQueryClient();
  const token = useAuthStore(state => state.accessToken);
  const toast = useToast();
  const { isOnline } = useNetworkStatus();
  const currentUserId = useAuthStore(state => state.userId);

  useEffect(() => {
    if (!token || !eventId || !isOnline) {
      if (!isOnline) {
         toast.show('You are currently offline.', 'error', 'No Connection');
      }
      return;
    }

    const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001/v1';
    const sseUrl = `${API_BASE_URL}/events/${eventId}/live?token=${token}`;

    let manager = sseManagers.get(eventId);
    if (!manager) {
      manager = new SSEManager(sseUrl, token);
      sseManagers.set(eventId, manager);
    }

    // 1. registration_count updates
    const onRegistrationCount = (payload: any) => {
       // Strict rule: "update only the event capacity query"
       queryClient.setQueryData(['events', eventId], (oldData: any) => {
         if (!oldData) return oldData;
         return { ...oldData, registrationCount: payload.count };
       });
    };

    // 2. waitlist_update (Waitlist promotion)
    const onWaitlistUpdate = (payload: any) => {
       // Strict rule: "update only the current user's registration query if the user_id matches"
       if (payload.user_id === currentUserId && payload.status === 'REGISTERED') {
          queryClient.setQueryData(['events', eventId, 'registration'], (oldData: any) => {
             if (!oldData) return oldData;
             return { ...oldData, status: 'REGISTERED' };
          });
          toast.show('You have been moved off the waitlist for the event!', 'success', 'Promoted!');
          // Invalidate to refresh full roster just in case
          queryClient.invalidateQueries({ queryKey: ['events', eventId] });
       }
    };

    // 3. heartbeat
    const onHeartbeat = () => {
       // Strict rule: "update connection status only"
       // The underlying SSEManager automatically resets its timeout, no cache mutation required.
    };

    manager.on('registration_count', onRegistrationCount);
    manager.on('waitlist_update', onWaitlistUpdate);
    manager.on('heartbeat', onHeartbeat);

    manager.connect();

    return () => {
       manager?.disconnect();
       sseManagers.delete(eventId);
    };
  }, [eventId, token, isOnline, queryClient, currentUserId]);
};
