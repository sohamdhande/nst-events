import { test, expect, vi, beforeEach } from 'vitest';
import { getWebAuthStore } from '../lib/auth-store';
import { getQueryClient } from '../lib/query-client';
const queryClient = getQueryClient();

beforeEach(() => {
  vi.unstubAllGlobals();
  getWebAuthStore().logout();
});

test('Web Foundation: Logout completely clears the QueryClient cache', () => {
  // Pre-populate some dummy private data in the cache
  queryClient.setQueryData(['private-user-data'], { secret: '123' });
  
  expect(queryClient.getQueryData(['private-user-data'])).toEqual({ secret: '123' });

  // Trigger logout
  getWebAuthStore().logout();

  // Cache must be cleared
  expect(queryClient.getQueryData(['private-user-data'])).toBeUndefined();
  expect(getWebAuthStore().accessToken).toBeNull();
});

test('Web Foundation: Auth store is memory only', () => {
  const store = getWebAuthStore();
  store.setAccessToken('token');
  expect(store.accessToken).toBe('token');
});
