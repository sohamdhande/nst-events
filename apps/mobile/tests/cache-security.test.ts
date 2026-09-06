import { test, expect, vi } from 'vitest';
import { useAuthStore } from '../src/store/auth';
import { queryClient } from '../src/providers/QueryProvider';
import { logout } from '../src/services/session';
import * as SecureStore from 'expo-secure-store';

let store: Record<string, string> = {};

vi.mock('expo-secure-store', () => ({
  setItemAsync: async (key: string, value: string) => { store[key] = value; },
  getItemAsync: async (key: string) => store[key] || null,
  deleteItemAsync: async (key: string) => { delete store[key]; },
  _reset: () => { store = {}; }
}));

vi.mock('expo-router', () => ({
  router: {
    replace: vi.fn(),
  }
}));

test('Mobile Cache Security: React Query cache is flushed on logout', async () => {
  store = {};

  // 1. User A session exists
  await useAuthStore.getState().setSession('user-a-uuid', 'token-a', 'refresh-a');
  expect(useAuthStore.getState().isLoggedIn).toBe(true);

  // 2. User A private server-state cache is populated
  queryClient.setQueryData(['events', 'private-event-1'], { title: 'Secret Event' });
  queryClient.setQueryData(['registrations', 'user-a-uuid'], [{ id: 1 }]);

  expect((queryClient.getQueryData(['events', 'private-event-1']) as any)?.title).toBe('Secret Event');

  // 3. Logout executes
  await logout();

  // 4. React Query cache contains no User A private data
  expect(queryClient.getQueryData(['events', 'private-event-1'])).toBeUndefined();
  expect(queryClient.getQueryData(['registrations', 'user-a-uuid'])).toBeUndefined();

  // 5. Auth state is cleared
  expect(useAuthStore.getState().isLoggedIn).toBe(false);
  expect(useAuthStore.getState().userId).toBeNull();
  expect(useAuthStore.getState().accessToken).toBeNull();
  expect(await SecureStore.getItemAsync('access_token')).toBeNull();

  // 6. User B starts a session
  await useAuthStore.getState().setSession('user-b-uuid', 'token-b', 'refresh-b');
  expect(useAuthStore.getState().userId).toBe('user-b-uuid');

  // 7. User B cannot observe User A's previous cached data
  expect(queryClient.getQueryData(['events', 'private-event-1'])).toBeUndefined();
});
