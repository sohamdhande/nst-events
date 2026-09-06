import React, { useMemo } from 'react';
import { View, StyleSheet, SafeAreaView, StatusBar, TouchableOpacity } from 'react-native';
import { useAppTheme } from '../store/theme-store';
import { Title, Body, MonoLabel } from './core/Typography';
import { Button } from './Button';

interface AttendanceSuccessViewProps {
  locationName: string;
  timeLogged: string;
  onReturnHome: () => void;
}

export const AttendanceSuccessView: React.FC<AttendanceSuccessViewProps> = ({
  locationName,
  timeLogged,
  onReturnHome,
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
    contentCard: {
      backgroundColor: theme.colors.surface,
      padding: theme.spacing.xl,
      marginVertical: 'auto',
      alignItems: 'center',
    },
    title: {
      fontSize: 28,
      color: theme.colors.primary,
      textAlign: 'center',
      marginBottom: theme.spacing.sm,
    },
    subtitle: {
      fontSize: 14,
      color: theme.colors.onSurfaceVariant,
      textAlign: 'center',
      marginBottom: theme.spacing.xl,
    },
    detailsBox: {
      width: '100%',
      backgroundColor: theme.colors.surfaceContainerLow,
      padding: theme.spacing.md,
      borderRadius: theme.borderRadius.sm,
      gap: theme.spacing.sm,
    },
    detailRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 4,
    },
    detailLabel: {
      fontSize: 11,
      color: theme.colors.onSurfaceVariant,
    },
    detailValueBold: {
      fontFamily: theme.typography.interSemiBold,
      fontSize: 14,
      color: theme.colors.primary,
    },
    detailValue: {
      fontSize: 14,
      color: theme.colors.primary,
    },
    actionTray: {
      gap: theme.spacing.sm,
    },
    homeBtn: {
      height: 52,
    },
  }), [theme]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle={theme.mode === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={theme.colors.surface} />
      <View style={styles.container}>
        <View style={styles.header}>
          <MonoLabel style={styles.authVer}>NST EVENTS</MonoLabel>
        </View>

        <View style={styles.contentCard}>
          <Title style={styles.title}>Attendance Recorded!</Title>
          <Body style={styles.subtitle}>
            You have successfully marked your attendance for this session.
          </Body>

          <View style={styles.detailsBox}>
            <View style={styles.detailRow}>
              <MonoLabel style={styles.detailLabel}>TIME</MonoLabel>
              <Body style={styles.detailValue}>{timeLogged}</Body>
            </View>

            <View style={styles.detailRow}>
              <MonoLabel style={styles.detailLabel}>LOCATION</MonoLabel>
              <Body style={styles.detailValue}>{locationName}</Body>
            </View>
          </View>
        </View>

        <View style={styles.actionTray}>
          <Button
            title="RETURN TO HOME"
            onPress={onReturnHome}
            variant="primary"
            style={styles.homeBtn}
          />
        </View>
      </View>
    </SafeAreaView>
  );
};
