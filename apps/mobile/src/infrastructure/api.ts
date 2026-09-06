import { useAuthStore } from '../store/auth';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.6.254:3001';

let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;

export const apiClient = async (endpoint: string, options: RequestInit = {}) => {
  const token = useAuthStore.getState().accessToken;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const fullUrl = `${API_BASE_URL}${endpoint}`;
  console.log('[API FETCH] Full constructed URL:', fullUrl, '| Method:', options.method || 'GET');

  const response = await fetch(fullUrl, {
    ...options,
    headers,
  });

  // Automatic token refresh on 401
  if (response.status === 401 && token) {
    // Deduplicate concurrent refresh attempts
    if (!isRefreshing) {
      isRefreshing = true;
      refreshPromise = useAuthStore.getState().refreshAccessToken();
    }

    const newToken = await refreshPromise;
    isRefreshing = false;
    refreshPromise = null;

    if (newToken) {
      // Retry the original request with the new token
      headers['Authorization'] = `Bearer ${newToken}`;
      const retryResponse = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers,
      });

      if (!retryResponse.ok) {
        const errorBody = await retryResponse.json().catch(() => ({}));
        throw { status: retryResponse.status, message: errorBody.message || errorBody.error || 'API Request Failed', body: errorBody };
      }

      const text = await retryResponse.text();
      return text ? JSON.parse(text) : {};
    }

    // Refresh failed — session is dead
    await useAuthStore.getState().clearSession();
    throw { status: 401, message: 'Session expired' };
  }

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw { status: response.status, message: errorBody.message || errorBody.error || 'API Request Failed', body: errorBody };
  }

  // Handle empty responses
  const text = await response.text();
  return text ? JSON.parse(text) : {};
};
