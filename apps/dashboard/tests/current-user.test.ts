import { test, expect, vi, beforeEach } from 'vitest';
import { apiClient } from '../lib/api';
import { getWebAuthStore } from '../lib/auth-store';
import { getQueryClient } from '../lib/query-client';
const queryClient = getQueryClient();

beforeEach(() => {
  vi.unstubAllGlobals();
  getWebAuthStore().logout();
  queryClient.clear();
});

test('Web Current User: Fetch successful /users/me', async () => {
  const mockResponse = {
    id: 'user-123',
    email: 'test@university.edu',
    full_name: 'Test Admin',
    avatar_url: null,
    global_role: 'PLATFORM_ADMIN',
    club_memberships: [
      { club_id: 'club-1', club_name: 'Tech Club', role: 'CLUB_ADMIN' }
    ]
  };

  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    text: async () => JSON.stringify(mockResponse),
    headers: new Headers(),
  });
  vi.stubGlobal('fetch', fetchMock);

  // set token to simulate authenticated state
  getWebAuthStore().setAccessToken('secret-token');

  const result = await apiClient('/users/me');
  
  expect(result).toEqual(mockResponse);
  expect(result.global_role).toBe('PLATFORM_ADMIN');
  expect(result.club_memberships[0].role).toBe('CLUB_ADMIN');
});

test('Web Current User: API Error', async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: false,
    status: 500,
    json: async () => ({ message: 'Internal Server Error' }),
    headers: new Headers(),
  });
  vi.stubGlobal('fetch', fetchMock);

  getWebAuthStore().setAccessToken('secret-token');

  await expect(apiClient('/users/me')).rejects.toThrow('Internal Server Error');
});

test('Web Current User: Logout clears cached current-user data', () => {
  queryClient.setQueryData(['users', 'me'], { id: 'test-123' });
  expect(queryClient.getQueryData(['users', 'me'])).toBeDefined();

  getWebAuthStore().logout();

  expect(queryClient.getQueryData(['users', 'me'])).toBeUndefined();
});
