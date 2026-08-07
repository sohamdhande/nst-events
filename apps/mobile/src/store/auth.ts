import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

interface AuthState {
  userId: string | null;
  accessToken: string | null;
  isLoggedIn: boolean;
  setSession: (userId: string, token: string) => Promise<void>;
  clearSession: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  userId: null,
  accessToken: null,
  isLoggedIn: false,
  setSession: async (userId, token) => {
    await SecureStore.setItemAsync('access_token', token);
    await SecureStore.setItemAsync('user_id', userId);
    set({ userId, accessToken: token, isLoggedIn: true });
  },
  clearSession: async () => {
    await SecureStore.deleteItemAsync('access_token');
    await SecureStore.deleteItemAsync('user_id');
    set({ userId: null, accessToken: null, isLoggedIn: false });
  },
}));
