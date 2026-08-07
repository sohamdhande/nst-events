import React from 'react';
import { Stack } from 'expo-router';
import { AppQueryProvider } from '../src/providers/QueryProvider';
import { useNotifications } from '../src/hooks/use-notifications';

// Inner layout safely wrapped in React Query context
function RootLayoutInner() {
  // Execute global Push Token synchronization lifecycle in background
  useNotifications();

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
