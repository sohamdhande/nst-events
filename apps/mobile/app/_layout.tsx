import React, { useEffect } from 'react';
import { Stack, SplashScreen } from 'expo-router';
import { AppQueryProvider } from '../src/providers/QueryProvider';
import { useNotifications } from '../src/hooks/use-notifications';
import { useThemeStore } from '../src/store/theme-store';
import { useFonts } from 'expo-font';
import {
  Syne_700Bold,
  Syne_800ExtraBold,
} from '@expo-google-fonts/syne';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
} from '@expo-google-fonts/inter';
import {
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
  JetBrainsMono_700Bold,
} from '@expo-google-fonts/jetbrains-mono';

console.log('[APP BOOT] Literal EXPO_PUBLIC_API_URL:', process.env.EXPO_PUBLIC_API_URL);

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

// Inner layout safely wrapped in React Query context
function RootLayoutInner() {
  const [fontsLoaded, fontError] = useFonts({
    Syne_700Bold,
    Syne_800ExtraBold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    JetBrainsMono_400Regular,
    JetBrainsMono_500Medium,
    JetBrainsMono_700Bold,
  });

  const initTheme = useThemeStore((state) => state.initTheme);

  useEffect(() => {
    console.log('[APP BOOT MOUNT] Literal EXPO_PUBLIC_API_URL:', process.env.EXPO_PUBLIC_API_URL);
    initTheme();
  }, [initTheme]);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      // Hide the splash screen after the fonts have loaded (or an error was returned)
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  // Execute global Push Token synchronization lifecycle in background
  useNotifications();

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(app)" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AppQueryProvider>
      <RootLayoutInner />
    </AppQueryProvider>
  );
}

