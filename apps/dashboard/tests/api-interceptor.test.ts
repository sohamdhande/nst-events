import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { apiClient } from '../lib/api';
import { getWebAuthStore } from '../lib/auth-store';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

describe('apiClient 401 Interceptor', () => {
  let globalFetchMock: any;

  beforeEach(() => {
    const store = getWebAuthStore();
    store.setAccessToken('expired-token');
    // @ts-ignore
    // @ts-ignore
    global.window = { location: { href: '' } };

    globalFetchMock = vi.fn();
    global.fetch = globalFetchMock;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('Transparent Refresh: original request -> 401 -> /auth/refresh -> 200 -> original request retry -> 200', async () => {
    globalFetchMock.mockImplementation(async (url: string, options: any) => {
      // 1. Initial request fails with 401
      if (url === `${API_BASE_URL}/users/me` && options.headers['Authorization'] === 'Bearer expired-token') {
        return { ok: false, status: 401, headers: new Headers(), json: async () => ({}) };
      }
      
      // 2. Refresh request succeeds with 200
      if (url === `${API_BASE_URL}/auth/refresh`) {
        return { ok: true, status: 200, headers: new Headers(), json: async () => ({ access_token: 'new-fresh-token' }) };
      }

      // 3. Retry request succeeds with 200
      if (url === `${API_BASE_URL}/users/me` && options.headers['Authorization'] === 'Bearer new-fresh-token') {
        return { ok: true, status: 200, headers: new Headers(), json: async () => ({ id: 'user-1' }), text: async () => JSON.stringify({ id: 'user-1' }) };
      }

      return { ok: false, status: 500 };
    });

    const result = await apiClient('/users/me');
    expect(result).toEqual({ id: 'user-1' });

    // Verify exactly 3 fetch calls in correct order
    expect(globalFetchMock).toHaveBeenCalledTimes(3);
    expect(globalFetchMock.mock.calls[0][0]).toBe(`${API_BASE_URL}/users/me`);
    expect(globalFetchMock.mock.calls[1][0]).toBe(`${API_BASE_URL}/auth/refresh`);
    expect(globalFetchMock.mock.calls[2][0]).toBe(`${API_BASE_URL}/users/me`);
  });

  it('Dead Session: original request -> 401 -> /auth/refresh -> 401 -> logout -> /login', async () => {
    globalFetchMock.mockImplementation(async (url: string) => {
      if (url === `${API_BASE_URL}/users/me`) {
        return { ok: false, status: 401, headers: new Headers(), json: async () => ({}) };
      }
      if (url === `${API_BASE_URL}/auth/refresh`) {
        return { ok: false, status: 401, headers: new Headers(), json: async () => ({}) };
      }
      return { ok: false, status: 500 };
    });

    await expect(apiClient('/users/me')).rejects.toThrow('API Request Failed');

    // Verify window.location.href was set to /login
    expect(global.window.location.href).toBe('/login');
    // Verify token was cleared
    expect(getWebAuthStore().accessToken).toBeNull();
  });

  it('Concurrent Expiry: 5 API requests -> exactly 1 refresh request -> all 5 retry', async () => {
    let refreshCount = 0;
    
    globalFetchMock.mockImplementation(async (url: string, options: any) => {
      if (url === `${API_BASE_URL}/auth/refresh`) {
        refreshCount++;
        // Simulate network delay for the refresh
        await new Promise(resolve => setTimeout(resolve, 100));
        return { ok: true, status: 200, headers: new Headers(), json: async () => ({ access_token: 'new-token' }) };
      }

      if (options.headers['Authorization'] === 'Bearer expired-token') {
        return { ok: false, status: 401, headers: new Headers(), json: async () => ({}) };
      }
      
      if (options.headers['Authorization'] === 'Bearer new-token') {
        return { ok: true, status: 200, headers: new Headers(), json: async () => ({ success: true }), text: async () => JSON.stringify({ success: true }) };
      }

      return { ok: false, status: 500 };
    });

    const requests = Array.from({ length: 5 }).map((_, i) => apiClient(`/endpoint-${i}`));
    const results = await Promise.all(requests);

    expect(results).toHaveLength(5);
    results.forEach(res => expect(res).toEqual({ success: true }));

    // 5 original + 1 refresh + 5 retries = 11 calls
    expect(globalFetchMock).toHaveBeenCalledTimes(11);
    expect(refreshCount).toBe(1); // EXACTLY ONE refresh request
  });
});
