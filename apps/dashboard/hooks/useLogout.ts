import { useMutation } from '@tanstack/react-query';
import { apiClient } from '../lib/api';
import { getWebAuthStore } from '../lib/auth-store';
import { useRouter } from 'next/navigation';

export function useLogout() {
  const router = useRouter();

  return useMutation({
    mutationFn: async () => {
      // Best effort network call
      try {
        await apiClient('/auth/logout', { method: 'POST' });
      } catch (e) {
        // Ignore network errors on logout, we still want to clear local state
        console.error('Logout API failed', e);
      }
    },
    onSettled: () => {
      // Clear client state
      getWebAuthStore().logout();
      
      // Navigate to login
      router.push('/login');
    }
  });
}
