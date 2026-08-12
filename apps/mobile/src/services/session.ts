import { router } from 'expo-router';
import { useAuthStore } from '../store/auth';
import { queryClient } from '../providers/QueryProvider';

/**
 * Single session controller / logout boundary.
 * Orchestrates clearing local state, flushing cache, and resetting navigation.
 */
export async function logout() {
  // 1. Clear SecureStore and auth state (Zustand)
  await useAuthStore.getState().clearSession();

  // 2. Clear React Query cache to prevent cross-session cache bleed
  queryClient.clear();

  // 3. Reset navigation to authentication boundary
  router.replace('/(auth)');
}
