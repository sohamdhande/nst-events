import { test, expect, vi, beforeEach } from 'vitest';
import { apiClient } from '../lib/api';
import { getWebAuthStore } from '../lib/auth-store';

beforeEach(() => {
  vi.unstubAllGlobals();
});

test('Web Profile: Fetch current user profile', async () => {
  const mockUser = {
    id: 'user-1',
    email: 'student@example.com',
    full_name: 'John Student',
    avatar_url: null,
    global_role: 'STUDENT',
    club_memberships: []
  };

  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    text: async () => JSON.stringify(mockUser),
    headers: new Headers(),
  });
  vi.stubGlobal('fetch', fetchMock);

  const result = await apiClient('/users/me');
  expect(result).toEqual(mockUser);
});

test('Web Profile: Logout triggers backend and clears store', async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ success: true }),
    headers: new Headers(),
  });
  vi.stubGlobal('fetch', fetchMock);

  // Set initial token
  getWebAuthStore().setAccessToken('test-token');
  expect(getWebAuthStore().accessToken).toBe('test-token');

  // Backend call
  await apiClient('/auth/logout', { method: 'POST' });
  
  // Clear store
  getWebAuthStore().logout();
  expect(getWebAuthStore().accessToken).toBeNull();
});
