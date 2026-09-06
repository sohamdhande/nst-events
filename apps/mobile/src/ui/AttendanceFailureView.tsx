import React, { useMemo } from 'react';
import { View, StyleSheet, SafeAreaView, StatusBar } from 'react-native';
import { useAppTheme } from '../store/theme-store';
import { Button } from './Button';
import { Title, Body, MonoLabel } from './core/Typography';

export interface AttendanceFailureProps {
  errorCode?: string;
  errorMessage?: string;
  onRetryScan?: () => void;
  onReturnHome: () => void;
}

export const AttendanceFailureView: React.FC<AttendanceFailureProps> = ({
  errorCode = 'ATTENDANCE_FAILED',
  errorMessage,
  onRetryScan,
  onReturnHome,
}) => {
  const theme = useAppTheme();

  const getErrorDetails = () => {
    switch (errorCode) {
      case 'QR_EXPIRED':
        return {
          title: 'QR Code Expired',
          reason: 'This attendance QR code is no longer valid.',
          action: 'Please scan the live QR code displayed on the screen.',
        };
      case 'SESSION_CLOSED':
        return {
          title: 'Session Closed',
          reason: 'The attendance window for this session has ended.',
          action: 'Attendance is no longer being accepted.',
        };
      case 'EVENT_LOCKED':
        return {
          title: 'Event Locked',
          reason: 'This event is no longer accepting attendance changes.',
          action: 'Please contact the organizer if you believe this is an error.',
        };
      case 'OUTSIDE_GEOFENCE':
        return {
          title: 'Outside Venue',
          reason: 'We couldn\'t verify your location inside the authorized area.',
          action: 'Please move closer to the venue and try again.',
        };
      case 'MOCK_LOCATION_REJECTED':
        return {
          title: 'Location Check Failed',
          reason: 'We were unable to verify a highly accurate GPS location.',
          action: 'Ensure GPS accuracy is enabled and you have a clear signal.',
        };
      case 'ALREADY_RECORDED':
        return {
          title: 'Already Marked',
          reason: 'Your attendance for this session has already been recorded.',
          action: 'No further action is required.',
        };
      case 'NOT_REGISTERED':
        return {
          title: 'Not Registered',
          reason: 'You are not registered for this event.',
          action: 'Only registered students can mark attendance.',
        };
      case 'WAITLISTED':
        return {
          title: 'Waitlisted',
          reason: 'You are currently on the waitlist for this event.',
          action: 'Waitlisted attendees cannot mark attendance.',
        };
      case 'REGISTRATION_NOT_ELIGIBLE':
      case 'ACADEMICALLY_INELIGIBLE':
        return {
          title: 'Ineligible Batch',
          reason: 'Your academic program is not eligible for this session.',
          action: 'Please verify the event requirements.',
        };
      default:
        return {
          title: 'Verification Failed',
          reason: errorMessage || 'An unexpected error occurred while verifying attendance.',
          action: 'Please try again or return home.',
        };
    }
  };

  const details = getErrorDetails();

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
      marginBottom: theme.spacing.md,
    },
    codeSubtitle: {
      color: theme.colors.error,
      marginBottom: theme.spacing.sm,
    },
    messageBox: {
      alignItems: 'center',
      gap: theme.spacing.sm,
    },
    reasonText: {
      fontSize: 16,
      color: theme.colors.primary,
      textAlign: 'center',
    },
    actionText: {
      fontSize: 14,
      color: theme.colors.onSurfaceVariant,
      textAlign: 'center',
    },
    actionTray: {
      gap: theme.spacing.sm,
    },
    retryBtn: {
      height: 52,
    },
    homeBtn: {
      height: 48,
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
          <MonoLabel style={styles.codeSubtitle}>ERROR: {errorCode}</MonoLabel>
          <Title style={styles.title}>{details.title}</Title>
          
          <View style={styles.messageBox}>
            <Body style={styles.reasonText}>{details.reason}</Body>
            <Body style={styles.actionText}>{details.action}</Body>
          </View>
        </View>

        <View style={styles.actionTray}>
          {onRetryScan && errorCode !== 'ALREADY_RECORDED' && (
            <Button
              title="RETRY SCAN"
              onPress={onRetryScan}
              variant="primary"
              style={styles.retryBtn}
            />
          )}
          <Button
            title="RETURN TO HOME"
            onPress={onReturnHome}
            variant="secondary"
            style={styles.homeBtn}
          />
        </View>
      </View>
    </SafeAreaView>
  );
};
