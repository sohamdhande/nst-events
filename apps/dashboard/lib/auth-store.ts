// In-memory access token store for Web (Next.js client)
// This strictly avoids localStorage to prevent XSS exfiltration of access tokens.
// The refresh token is managed exclusively via HttpOnly cookies by the backend.

import { queryClient } from './query-client';

export interface WebAuthStore {
  accessToken: string | null;
  setAccessToken: (token: string | null) => void;
  logout: () => void;
}

const authState: WebAuthStore = {
  accessToken: null,
  setAccessToken: (token: string | null) => {
    authState.accessToken = token;
  },
  logout: () => {
    authState.accessToken = null;
    queryClient.clear();
    // In a real application, this would also trigger a redirect or context update
  },
};

export const getWebAuthStore = () => authState;
