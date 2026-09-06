import React, { useEffect, useMemo } from 'react';
import { View, ActivityIndicator, StyleSheet, SafeAreaView, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../src/store/auth';
import { useAppTheme } from '../src/store/theme-store';

export default function RootIndexScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn);
  const isInitialized = useAuthStore((state) => state.isInitialized);
  const initSession = useAuthStore((state) => state.initSession);

  useEffect(() => {
    initSession();
  }, [initSession]);

  useEffect(() => {
    if (!isInitialized) return;

    if (isLoggedIn) {
      router.replace('/(app)');
    } else {
      router.replace('/(auth)');
    }
  }, [isInitialized, isLoggedIn, router]);

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.surface,
      justifyContent: 'center',
      alignItems: 'center',
    },
    centerBox: {
      alignItems: 'center',
      gap: 12,
    },
  }), [theme]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={theme.mode === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={theme.colors.surface} />
      <View style={styles.centerBox}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    </SafeAreaView>
  );
}
