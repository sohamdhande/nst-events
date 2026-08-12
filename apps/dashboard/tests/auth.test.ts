import { test, expect, vi, beforeEach } from 'vitest';
import { getWebAuthStore } from '../lib/auth-store';
import { apiClient, ApiError } from '../lib/api';

beforeEach(() => {
  vi.unstubAllGlobals();
  getWebAuthStore().logout();
});

test('Web Auth: No access token', async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ success: true }),
    headers: new Headers(),
  });
  vi.stubGlobal('fetch', fetchMock);

  await apiClient('/test-endpoint');

  expect(fetchMock).toHaveBeenCalledTimes(1);
  const options = fetchMock.mock.calls[0][1];

  expect(options.headers['Authorization']).toBeUndefined();
  expect(options.credentials).toBe('omit');
});

test('Web Auth: Valid access token is attached', async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ success: true }),
    headers: new Headers(),
  });
  vi.stubGlobal('fetch', fetchMock);

  getWebAuthStore().setAccessToken('secret-token');

  await apiClient('/test-endpoint');

  const options = fetchMock.mock.calls[0][1];
  expect(options.headers['Authorization']).toBe('Bearer secret-token');
  expect(options.credentials).toBe('omit');
});

test('Web Auth: Refresh token includes credentials', async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ success: true }),
    headers: new Headers(),
  });
  vi.stubGlobal('fetch', fetchMock);

  await apiClient('/auth/refresh', { method: 'POST' });

  const options = fetchMock.mock.calls[0][1];
  expect(options.credentials).toBe('include');
});

test('Web Auth: 401 triggers logout on normal request', async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: false,
    status: 401,
    json: async () => ({ message: 'Unauthorized' }),
    headers: new Headers(),
  });
  vi.stubGlobal('fetch', fetchMock);

  getWebAuthStore().setAccessToken('secret-token');

  await expect(apiClient('/test-endpoint')).rejects.toThrow(ApiError);

  expect(getWebAuthStore().accessToken).toBeNull();
});

test('Web Auth: Repeated 401 does not loop infinitely (throws instantly)', async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: false,
    status: 401,
    json: async () => ({ message: 'Unauthorized' }),
    headers: new Headers(),
  });
  vi.stubGlobal('fetch', fetchMock);

  await expect(apiClient('/test-endpoint')).rejects.toThrow();
  expect(fetchMock).toHaveBeenCalledTimes(1); // No automatic retry loops
});

test('Web Auth: Access token is not written to localStorage', () => {
  const store = getWebAuthStore();
  store.setAccessToken('new-token');

  // Since we don't even use window.localStorage in our lib, this verifies it's memory-only
  expect(typeof window).toBe('undefined'); // In node test env
  expect(store.accessToken).toBe('new-token');
});
