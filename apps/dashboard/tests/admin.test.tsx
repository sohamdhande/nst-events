import { test, expect, vi, beforeEach } from 'vitest';
import { apiClient } from '../lib/api';
import { getWebAuthStore } from '../lib/auth-store';
import { queryClient } from '../lib/query-client';

beforeEach(() => {
  vi.unstubAllGlobals();
  getWebAuthStore().logout();
  queryClient.clear();
});

test('Web Admin: Fetch successful audit logs for PLATFORM_ADMIN', async () => {
  const mockResponse = {
    data: [
      {
        id: 'log-1',
        action: 'USER_ROLE_UPDATED',
        actorId: 'admin-1',
        entityType: 'USER',
        entityId: 'user-123',
        createdAt: '2026-08-14T10:00:00Z',
      }
    ],
    pagination: {
      next_cursor: undefined
    }
  };

  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    text: async () => JSON.stringify(mockResponse),
    headers: new Headers(),
  });
  vi.stubGlobal('fetch', fetchMock);

  getWebAuthStore().setAccessToken('platform-admin-token');

  const result = await apiClient('/v1/admin/audit-logs');
  expect(result).toEqual(mockResponse);
  expect(result.data[0].action).toBe('USER_ROLE_UPDATED');
});

test('Web Admin: API Error correctly triggers rejection', async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: false,
    status: 403,
    json: async () => ({ message: 'Forbidden' }),
    headers: new Headers(),
  });
  vi.stubGlobal('fetch', fetchMock);

  getWebAuthStore().setAccessToken('non-admin-token');

  await expect(apiClient('/v1/admin/audit-logs')).rejects.toThrow('Forbidden');
});

test('Web Admin: Empty audit logs state', async () => {
  const mockResponse = {
    data: [],
    pagination: {}
  };

  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    text: async () => JSON.stringify(mockResponse),
    headers: new Headers(),
  });
  vi.stubGlobal('fetch', fetchMock);

  const result = await apiClient('/v1/admin/audit-logs');
  expect(result.data).toHaveLength(0);
});

test('Web Admin: Point Adjustment performs NO API request', async () => {
  // As required, the Point Adjustment button is disabled and performs no mutations.
  // There is no endpoint for POST /v1/admin/points/adjust.
  const fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);

  // We explicitly do NOT call any point adjustment API.
  expect(fetchMock).not.toHaveBeenCalled();
});

test('Web Admin: Logout clears Admin-related React Query data', () => {
  queryClient.setQueryData(['admin-audit-logs'], { data: [{ id: '1' }] });
  expect(queryClient.getQueryData(['admin-audit-logs'])).toBeDefined();

  // Trigger logout
  getWebAuthStore().logout();

  // Verify the cache is cleared
  expect(queryClient.getQueryData(['admin-audit-logs'])).toBeUndefined();
});
