/**
 * Minimal Web API Foundation Architecture
 * Establishes typed client, error handling, and authentication boundaries for Dashboard.
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
import { getWebAuthStore } from './auth-store';
export class ApiError extends Error {
  status: number;
  data: any;
  requestId?: string;

  constructor(status: number, message: string, data: any, requestId?: string) {
    super(message);
    this.status = status;
    this.data = data;
    this.requestId = requestId;
    this.name = 'ApiError';
  }
}

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

  const response = await fetch(`${API_BASE_URL}${endpoint}`, fetchOptions);

  const requestId = response.headers.get('x-request-id') || undefined;

  if (!response.ok) {
    let errorBody: any = {};
    try {
      errorBody = await response.json();
    } catch {
      // Body might be empty or plain text
    }
    if (response.status === 401 && endpoint !== '/auth/refresh') {
      authStore.logout(); // Clear memory session on unrecoverable auth failure (refresh flow blocked by concurrency concerns)
    }

    throw new ApiError(
      response.status,
      errorBody?.message || 'API Request Failed',
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
