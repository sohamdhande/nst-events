import React, { useMemo } from 'react';
import { View, Text, StyleSheet, SafeAreaView, StatusBar, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useAppTheme } from '../../src/store/theme-store';
import { Button } from '../../src/ui/Button';
import { useUserProfile } from '../../src/hooks/use-user-profile';
import { useAuthStore } from '../../src/store/auth';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function AppLayout() {
  const router = useRouter();
  const theme = useAppTheme();
  const clearSession = useAuthStore((state) => state.clearSession);
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn);
  const { data: profile, isLoading, isError } = useUserProfile();
  const insets = useSafeAreaInsets();

  const dynamicBottomPadding = Math.max(insets.bottom, 6);
  const dynamicTabBarHeight = 54 + dynamicBottomPadding;

  const styles = useMemo(() => StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.colors.surface,
    },
    centerContainer: {
      flex: 1,
      backgroundColor: theme.colors.surface,
      justifyContent: 'center',
      alignItems: 'center',
      padding: theme.spacing.base,
    },
    loadingCard: {
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.primary,
      padding: theme.spacing.xl,
      alignItems: 'center',
      gap: theme.spacing.md,
      width: '100%',
    },
    loadingTitle: {
      fontFamily: theme.typography.monoBold,
      fontSize: 11,
      color: theme.colors.primary,
      letterSpacing: 0.8,
    },
    loadingSub: {
      fontFamily: theme.typography.monoMedium,
      fontSize: 9,
      color: theme.colors.onSurfaceVariant,
    },
    accessDeniedContainer: {
      flex: 1,
      paddingHorizontal: theme.spacing.base,
      paddingVertical: theme.spacing.md,
      justifyContent: 'space-between',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingBottom: theme.spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.borderHairline,
    },
    badgeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    errorDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: theme.colors.error,
    },
    headerMonoText: {
      fontFamily: theme.typography.monoBold,
      fontSize: 10,
      color: theme.colors.primary,
      letterSpacing: 0.8,
    },
    restrictedPill: {
      backgroundColor: theme.colors.errorContainer,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    restrictedPillText: {
      fontFamily: theme.typography.monoBold,
      fontSize: 9,
      color: theme.colors.onErrorContainer,
    },
    deniedCard: {
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.error,
      padding: theme.spacing.base,
      gap: theme.spacing.sm,
      marginVertical: 'auto',
    },
    deniedTitle: {
      fontFamily: theme.typography.syneExtraBold,
      fontSize: 24,
      color: theme.colors.primary,
    },
    deniedSubtitle: {
      fontFamily: theme.typography.interRegular,
      fontSize: 13,
      lineHeight: 18,
      color: theme.colors.onSurfaceVariant,
    },
    ledgerBox: {
      backgroundColor: theme.colors.surfaceContainerLow,
      borderWidth: 1,
      borderColor: theme.colors.outlineVariant,
      marginTop: 6,
    },
    ledgerRow: {
      padding: theme.spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.outlineVariant,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    ledgerRowLast: {
      padding: theme.spacing.sm,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    ledgerLabel: {
      fontFamily: theme.typography.monoBold,
      fontSize: 9,
      color: theme.colors.onSurfaceVariant,
    },
    ledgerValue: {
      fontFamily: theme.typography.monoMedium,
      fontSize: 11,
      color: theme.colors.primary,
    },
    ledgerValueTag: {
      fontFamily: theme.typography.monoBold,
      fontSize: 11,
      color: theme.colors.error,
    },
    ledgerValueTagActive: {
      fontFamily: theme.typography.monoBold,
      fontSize: 11,
      color: theme.colors.secondary,
    },
    noticeBody: {
      fontFamily: theme.typography.interMedium,
      fontSize: 12,
      color: theme.colors.onSurfaceVariant,
      lineHeight: 16,
      marginTop: 4,
    },
    actionTray: {
      gap: theme.spacing.sm,
    },
    actionButton: {
      height: 52,
    },
    customTabBar: {
      flexDirection: 'row',
      backgroundColor: theme.colors.surfaceContainerLowest,
      borderTopWidth: 1,
      borderTopColor: theme.colors.outlineVariant,
      paddingTop: 8,
      paddingHorizontal: 8,
    },
    customTabItem: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 8,
      marginHorizontal: 4,
      borderRadius: 0, // Sharp edge enforcement
    },
    customTabItemActive: {
      backgroundColor: theme.colors.surfaceContainerHigh,
    },
    customTabLabel: {
      fontFamily: theme.typography.monoBold,
      fontSize: 9,
      letterSpacing: 0.5,
      marginTop: 4,
      color: theme.colors.onSurfaceVariant,
    },
    customTabLabelActive: {
      color: theme.colors.primaryFixed,
    },
  }), [theme]);

  React.useEffect(() => {
    if (!isLoggedIn || isError) {
      clearSession().then(() => {
        router.replace('/(auth)');
      });
    }
  }, [isLoggedIn, isError, clearSession, router]);

  // 1. Loading State: Render Credential Validator
  if (isLoading) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <StatusBar barStyle={theme.mode === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={theme.colors.surface} />
        <View style={styles.loadingCard}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingTitle}>VERIFYING STUDENT CREDENTIALS...</Text>
          <Text style={styles.loadingSub}>AUTHENTICATING STUDENT ACCOUNT...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // 2. Non-Student Role Access Denied State (FACULTY_ADMIN / PLATFORM_ADMIN / FACULTY_MENTOR)
  if (profile && profile.global_role !== 'STUDENT') {
    const handleSwitchAccount = async () => {
      await clearSession();
      router.replace('/(auth)');
    };

    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle={theme.mode === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={theme.colors.surface} />
        <View style={styles.accessDeniedContainer}>
          {/* Header Bar */}
          <View style={styles.header}>
            <View style={styles.badgeRow}>
              <View style={styles.errorDot} />
              <Text style={styles.headerMonoText}>NST EVENTS // MOBILE ACCESS</Text>
            </View>
            <View style={styles.restrictedPill}>
              <Text style={styles.restrictedPillText}>[ACCESS_RESTRICTED]</Text>
            </View>
          </View>

          {/* Center Card */}
          <View style={styles.deniedCard}>
            <Text style={styles.deniedTitle}>Student Access Required</Text>
            <Text style={styles.deniedSubtitle}>
              The NST-Events Student Mobile application is restricted to enrolled student accounts.
            </Text>

            <View style={styles.ledgerBox}>
              <View style={styles.ledgerRow}>
                <Text style={styles.ledgerLabel}>AUTHENTICATED USER</Text>
                <Text style={styles.ledgerValue}>{profile.email}</Text>
              </View>
              <View style={styles.ledgerRow}>
                <Text style={styles.ledgerLabel}>DETECTED GLOBAL ROLE</Text>
                <Text style={styles.ledgerValueTag}>[{profile.global_role}]</Text>
              </View>
              <View style={styles.ledgerRowLast}>
                <Text style={styles.ledgerLabel}>REQUIRED GLOBAL ROLE</Text>
                <Text style={styles.ledgerValueTagActive}>[STUDENT]</Text>
              </View>
            </View>

            <Text style={styles.noticeBody}>
              Administrative and faculty users must access the desktop web dashboard to manage events and approvals.
            </Text>
          </View>

          {/* Action Tray */}
          <View style={styles.actionTray}>
            <Button
              title="SWITCH ACCOUNT / LOG OUT"
              onPress={handleSwitchAccount}
              variant="primary"
              style={styles.actionButton}
            />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // 3. Allowed Student Mobile Shell (global_role === 'STUDENT')
  return (
    <Tabs
      tabBar={({ state, descriptors, navigation }: any) => {
        const allowedRoutes = ['index', 'history', 'profile'];
        const visibleRoutes = state.routes.filter((r: any) => allowedRoutes.includes(r.name));

        return (
          <View style={[styles.customTabBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
            {visibleRoutes.map((route: any) => {
              const { options } = descriptors[route.key];
              const isFocused = state.index === state.routes.findIndex((r: any) => r.key === route.key);

              const onPress = () => {
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });

                if (!isFocused && !event.defaultPrevented) {
                  navigation.navigate(route.name as any);
                }
              };

              let iconName: any = 'help';
              let label = route.name;
              if (route.name === 'index') {
                iconName = 'qr-code-scanner';
                label = 'ATTENDANCE';
              } else if (route.name === 'history') {
                iconName = 'history';
                label = 'HISTORY';
              } else if (route.name === 'profile') {
                iconName = 'person';
                label = 'PROFILE';
              }

              return (
                <TouchableOpacity
                  key={route.key}
                  onPress={onPress}
                  activeOpacity={0.8}
                  style={[
                    styles.customTabItem,
                    isFocused && styles.customTabItemActive,
                  ]}
                >
                  <MaterialIcons
                    name={iconName}
                    size={20}
                    color={isFocused ? theme.colors.primaryFixed : theme.colors.onSurfaceVariant}
                  />
                  <Text
                    style={[
                      styles.customTabLabel,
                      isFocused && styles.customTabLabelActive,
                    ]}
                    numberOfLines={1}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        );
      }}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="history" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
