import { useEffect } from 'react';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { useMutation } from '@tanstack/react-query';
import { apiClient } from '../infrastructure/api';
import { useAuthStore } from '../store/auth';
import { useRouter } from 'expo-router';

const TOKEN_CACHE_KEY = 'last_synced_push_token';
const USER_CACHE_KEY = 'last_synced_push_user_id';

export function useNotifications() {
  const userId = useAuthStore((state) => state.userId);
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn);
  const router = useRouter();
  const lastNotificationResponse = Notifications.useLastNotificationResponse();

  const { mutate: syncToken } = useMutation({
    mutationFn: async (expoToken: string) => {
      if (!userId) return;
      return apiClient('/v1/users/me/push-token', {
        method: 'POST',
        body: JSON.stringify({
          expoToken,
          deviceId: Device.osBuildId || Device.modelName || 'unknown-device',
          platform: Platform.OS.toUpperCase(),
        }),
      });
    },
    onSuccess: async (_, expoToken) => {
      // Persist the last synchronized token and user ID exactly as documented
      if (userId) {
        await SecureStore.setItemAsync(TOKEN_CACHE_KEY, expoToken);
        await SecureStore.setItemAsync(USER_CACHE_KEY, userId);
      }
    },
    retry: 3, // Safe React Query exponential backoff
  });

  // Handle incoming notification interaction (Deep Linking)
  useEffect(() => {
    if (lastNotificationResponse && isLoggedIn) {
      const { notification } = lastNotificationResponse;
      const metadata = notification.request.content.data?.metadata as any;
      
      if (metadata?.entity_ids?.invitation_id) {
        // Preferred deep link for team invitations
        router.push({ pathname: '/invitations', params: { invitationId: metadata.entity_ids.invitation_id } });
      } else if (metadata?.routing?.target === 'event_details' && metadata?.routing?.params?.id) {
        router.push(`/events/${metadata.routing.params.id}`);
      }
    }
  }, [lastNotificationResponse, isLoggedIn, router]);

  useEffect(() => {
    let isMounted = true;

    async function registerForPushNotificationsAsync() {
      // 1. Cleanup lifecycle (logout or account switch)
      if (!isLoggedIn || !userId) {
        await SecureStore.deleteItemAsync(TOKEN_CACHE_KEY);
        await SecureStore.deleteItemAsync(USER_CACHE_KEY);
        return;
      }

      // 2. Simulator bypass (prevent crash)
      if (!Device.isDevice) {
        return;
      }

      // 3. Strict Permission rules
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      // If denied: do not retry repeatedly, do not spam, exit gracefully
      if (finalStatus !== 'granted') {
        return;
      }

      try {
        const projectId = Constants.expoConfig?.extra?.eas?.projectId;
        if (!projectId) {
          console.warn('EAS projectId not configured — push token registration skipped');
          return;
        }
        
        const tokenResponse = await Notifications.getExpoPushTokenAsync({
          projectId,
        });
        
        const token = tokenResponse.data;

        if (!isMounted) return;

        // 4. Token Synchronization Rules
        const lastToken = await SecureStore.getItemAsync(TOKEN_CACHE_KEY);
        const lastUserId = await SecureStore.getItemAsync(USER_CACHE_KEY);

        // Never POST the same token repeatedly. Only call if diff exists.
        if (lastToken !== token || lastUserId !== userId) {
          syncToken(token);
        }
      } catch (e) {
        // If offline or Expo API is unavailable, silently wait until next mount. Never block app startup.
        console.warn('Silent fail: Unable to get Expo Push Token');
      }
    }

    registerForPushNotificationsAsync();

    // Token refresh lifecycle listener
    const subscription = Notifications.addPushTokenListener((newToken) => {
      if (isLoggedIn && userId) {
        syncToken(newToken.data);
      }
    });

    return () => {
      isMounted = false;
      subscription.remove();
    };
  }, [userId, isLoggedIn, syncToken]);
}
