import { create } from 'zustand';
import { Appearance, ColorSchemeName, useColorScheme } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { theme, lightColors, darkColors } from '../ui/theme';

export type ThemeMode = 'system' | 'light' | 'dark';

interface ThemeState {
  mode: ThemeMode;
  isInitialized: boolean;
  initTheme: () => Promise<void>;
  setMode: (mode: ThemeMode) => Promise<void>;
}

export const useThemeStore = create<ThemeState>((set) => ({
  mode: 'system',
  isInitialized: false,

  initTheme: async () => {
    try {
      const stored = await SecureStore.getItemAsync('app_appearance_mode') as ThemeMode | null;
      console.log(`[Theme] Store hydrated: ${stored || 'none'}`);
      if (stored === 'light' || stored === 'dark') {
        Appearance.setColorScheme(stored);
        set({ mode: stored, isInitialized: true });
      } else {
        const systemScheme = Appearance.getColorScheme() || 'dark';
        Appearance.setColorScheme(systemScheme);
        set({ mode: 'system', isInitialized: true });
      }
    } catch {
      set({ isInitialized: true });
    }
  },

  setMode: async (mode: ThemeMode) => {
    console.log(`[Theme] Setting mode: ${mode}`);
    if (mode === 'system') {
      const systemScheme = Appearance.getColorScheme() || 'dark';
      Appearance.setColorScheme(systemScheme);
      await SecureStore.deleteItemAsync('app_appearance_mode');
    } else {
      Appearance.setColorScheme(mode as ColorSchemeName);
      await SecureStore.setItemAsync('app_appearance_mode', mode);
    }
    set({ mode });
  },
}));

export function useAppTheme() {
  const mode = useThemeStore((state) => state.mode);
  const systemScheme = useColorScheme() || 'dark';

  const resolvedMode = mode === 'system' ? systemScheme : mode;
  const colors = resolvedMode === 'light' ? lightColors : darkColors;

  console.log(`[Theme] Current mode: ${mode}`);
  console.log(`[Theme] Resolved theme: ${resolvedMode}`);

  return {
    ...theme,
    colors,
    mode: resolvedMode,
  };
}
