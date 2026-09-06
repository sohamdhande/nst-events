import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.6.254:3001';

interface AuthState {
  userId: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  isLoggedIn: boolean;
  isInitialized: boolean;
  initSession: () => Promise<void>;
  setSession: (userId: string, accessToken: string, refreshToken: string) => Promise<void>;
  clearSession: () => Promise<void>;
  refreshAccessToken: () => Promise<string | null>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  userId: null,
  accessToken: null,
  refreshToken: null,
  isLoggedIn: false,
  isInitialized: false,

  initSession: async () => {
    try {
      const token = await SecureStore.getItemAsync('access_token');
      const userId = await SecureStore.getItemAsync('user_id');
      const refreshToken = await SecureStore.getItemAsync('refresh_token');
      if (token && userId && refreshToken) {
        set({ userId, accessToken: token, refreshToken, isLoggedIn: true, isInitialized: true });
      } else {
        set({ userId: null, accessToken: null, refreshToken: null, isLoggedIn: false, isInitialized: true });
      }
    } catch {
      set({ userId: null, accessToken: null, refreshToken: null, isLoggedIn: false, isInitialized: true });
    }
  },

  setSession: async (userId, accessToken, refreshToken) => {
    await SecureStore.setItemAsync('access_token', accessToken);
    await SecureStore.setItemAsync('user_id', userId);
    await SecureStore.setItemAsync('refresh_token', refreshToken);
    set({ userId, accessToken, refreshToken, isLoggedIn: true, isInitialized: true });
  },

  clearSession: async () => {
    await SecureStore.deleteItemAsync('access_token');
    await SecureStore.deleteItemAsync('user_id');
    await SecureStore.deleteItemAsync('refresh_token');
    set({ userId: null, accessToken: null, refreshToken: null, isLoggedIn: false, isInitialized: true });
  },

  /**
   * Refresh the access token using the stored refresh token.
   * Calls POST /auth/refresh DIRECTLY via fetch() — never through apiClient —
   * to prevent recursive 401-retry handling.
   * Returns the new access_token on success, or null on failure.
   */
  refreshAccessToken: async () => {
    const currentRefresh = get().refreshToken;
    if (!currentRefresh) return null;

    try {
      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: currentRefresh }),
      });

      if (!response.ok) return null;

      const data = await response.json();
      if (data.access_token && data.refresh_token) {
        await SecureStore.setItemAsync('access_token', data.access_token);
        await SecureStore.setItemAsync('refresh_token', data.refresh_token);
        set({ accessToken: data.access_token, refreshToken: data.refresh_token });
        return data.access_token;
      }
      return null;
    } catch {
      return null;
    }
  },
}));
