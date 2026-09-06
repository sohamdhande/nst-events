import React, { useMemo } from 'react';
import { View, StyleSheet, SafeAreaView, StatusBar, ActivityIndicator } from 'react-native';
import { useAppTheme } from '../store/theme-store';
import { Title, Body, MonoLabel } from './core/Typography';

interface AttendanceVerificationViewProps {
  statusText: string;
}

export const AttendanceVerificationView: React.FC<AttendanceVerificationViewProps> = ({
  statusText,
}) => {
  const theme = useAppTheme();

  const styles = useMemo(() => StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.colors.surface,
    },
    container: {
      flex: 1,
      paddingHorizontal: theme.spacing.base,
      paddingVertical: theme.spacing.md,
      justifyContent: 'space-between',
    },
    header: {
      alignItems: 'center',
      paddingBottom: theme.spacing.sm,
    },
    authVer: {
      color: theme.colors.onSurfaceVariant,
    },
    manifestCard: {
      backgroundColor: theme.colors.surface,
      padding: theme.spacing.xl,
      gap: theme.spacing.md,
      marginVertical: 'auto',
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: {
      fontSize: 24,
      color: theme.colors.primary,
      textAlign: 'center',
    },
    subtitle: {
      fontSize: 14,
      color: theme.colors.onSurfaceVariant,
      textAlign: 'center',
    },
    spinnerContainer: {
      marginTop: theme.spacing.xl,
      alignItems: 'center',
      gap: theme.spacing.base,
    },
    statusText: {
      color: theme.colors.secondary,
      letterSpacing: 1,
      textAlign: 'center',
    },
  }), [theme]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle={theme.mode === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={theme.colors.surface} />
      <View style={styles.container}>
        <View style={styles.header}>
          <MonoLabel style={styles.authVer}>NST EVENTS</MonoLabel>
        </View>

        <View style={styles.manifestCard}>
          <Title style={styles.title}>Verifying Attendance</Title>
          <Body style={styles.subtitle}>
            Please wait while we confirm your location and validate your session.
          </Body>

          <View style={styles.spinnerContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <MonoLabel style={styles.statusText}>{statusText.toUpperCase()}</MonoLabel>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
};
