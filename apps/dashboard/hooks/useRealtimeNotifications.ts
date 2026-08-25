import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getWebAuthStore } from '../lib/auth-store';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export function useRealtimeNotifications() {
  const queryClient = useQueryClient();
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const accessToken = getWebAuthStore().accessToken;
    
    // Only connect if the user is authenticated
    if (!accessToken) {
      return;
    }

    // React Strict Mode protection: avoid multiple connections
    if (eventSourceRef.current) {
      return;
    }

    // Security Tradeoff: EventSource in browsers does not support Authorization headers.
    // The SSE authentication middleware requires the token in the query string.
    // This briefly exposes the token in network logs, but it is necessary for this architecture.
    const url = `${API_BASE_URL}/v1/notifications/live?token=${accessToken}`;
    
    const es = new EventSource(url);
    eventSourceRef.current = es;

    // RECONNECT RECONCILIATION
    // When the connection opens (or reconnects natively), we fetch from REST
    // to ensure no notifications were missed while the connection was down.
    es.onopen = () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    };

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        // Disconnect immediately on system instruction to force reconnection/refresh
        if (data.type === 'system:disconnect') {
          es.close();
          eventSourceRef.current = null;
          return;
        }

        if (data.type === 'heartbeat') {
          return;
        }

        if (data.type === 'NOTIFICATION_CREATED') {
          // Refresh notifications and unread counts
          queryClient.invalidateQueries({ queryKey: ['notifications'] });
          
          // Action Center invalidation optimizations
          const notif = data.notification;
          if (notif?.type === 'TEAM_WAITLISTED' || notif?.type === 'REGISTRATION_STATUS_CHANGED') {
            queryClient.invalidateQueries({ queryKey: ['events'] });
          } else if (notif?.type === 'QUEUE_STALLED' || notif?.type === 'QUEUE_DEAD_LETTER') {
            queryClient.invalidateQueries({ queryKey: ['admin-queues'] });
          }
        } 
        
        else if (data.type === 'NOTIFICATION_READ' || data.type === 'NOTIFICATIONS_READ_ALL') {
          // Read state changed across sessions, sync authoritative counts
          queryClient.invalidateQueries({ queryKey: ['notifications'] });
        }

      } catch (e) {
        console.error('Failed to parse realtime notification event');
      }
    };

    es.onerror = () => {
      // EventSource automatically attempts to reconnect on error.
      // We don't implement a custom reconnect loop to avoid aggressive polling.
      // However, if authentication fails (401), we should close it to prevent infinite loops.
      if (es.readyState === EventSource.CLOSED) {
        eventSourceRef.current = null;
      }
    };

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [queryClient]);
}
