/**
 * Minimal Web API Foundation Architecture
 * Establishes typed client, error handling, and authentication boundaries for Dashboard.
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
import { getWebAuthStore } from './auth-store';

export class ApiError extends Error {
  status: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
  requestId?: string;

  constructor(status: number, message: string, data: any, requestId?: string) {
    super(message);
    Object.setPrototypeOf(this, ApiError.prototype);
    this.status = status;
    this.data = data;
    this.requestId = requestId;
    this.name = 'ApiError';
  }
}

// Module-level promise to prevent duplicate concurrent refresh requests across remounts and queries
let refreshPromise: Promise<string | null> | null = null;

export const refreshToken = async (): Promise<string | null> => {
  if (!refreshPromise) {
    refreshPromise = fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    })
      .then(async (res) => {
        if (!res.ok) return null;
        try {
          const data = await res.json();
          return data?.access_token || null;
        } catch {
          return null;
        }
      })
      .catch(() => null)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const apiClient = async <T = any>(endpoint: string, options: RequestInit = {}): Promise<T> => {
  // Web Authentication Integration Boundary
  // Expects cookies (httpOnly) or localStorage fallback depending on future auth implementation.
  // Currently backend relies on `Authorization: Bearer` or cookies. Dashboard will use cookies.
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  const authStore = getWebAuthStore();

  if (authStore.accessToken) {
    headers['Authorization'] = `Bearer ${authStore.accessToken}`;
  }

  // Ensure credentials (cookies) are sent with every request
  const fetchOptions: RequestInit = {
    ...options,
    headers,
    credentials: endpoint === '/auth/refresh' ? 'include' : 'omit',
  };

  let response = await fetch(`${API_BASE_URL}${endpoint}`, fetchOptions);
  let requestId = response.headers.get('x-request-id') || undefined;

  // Intercept 401 Unauthorized for transparent refresh & retry (exactly once)
  if (response.status === 401 && endpoint !== '/auth/refresh') {
    const newToken = await refreshToken();
    
    if (newToken) {
      authStore.setAccessToken(newToken);
      // Retry original request with new token
      fetchOptions.headers = {
        ...fetchOptions.headers,
        'Authorization': `Bearer ${newToken}`,
      };
      response = await fetch(`${API_BASE_URL}${endpoint}`, fetchOptions);
      requestId = response.headers.get('x-request-id') || undefined;
    }
  }

  if (!response.ok) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let errorBody: any = {};
    try {
      errorBody = await response.json();
    } catch {
      // Body might be empty or plain text
    }
    
    // Terminal authentication failure (retry failed or refresh failed)
    if (response.status === 401 && endpoint !== '/auth/refresh') {
      authStore.logout();
    }

    throw new ApiError(
      response.status,
      errorBody?.detail || errorBody?.message || 'API Request Failed',
      errorBody,
      requestId
    );
  }

  // Handle empty 204 No Content
  if (response.status === 204) {
    return {} as T;
  }

  const text = await response.text();
  return text ? JSON.parse(text) : ({} as T);
};
