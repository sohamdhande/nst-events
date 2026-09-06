import React, { useState, useMemo } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAppTheme } from '../../../src/store/theme-store';
import { StatusBadge } from '../../../src/ui/core/StatusBadge';
import { Button } from '../../../src/ui/Button';
import { useSubmitDispute } from '../../../src/hooks/use-disputes';
import { MobileShell } from '../../../src/ui/core/MobileShell';
import { Title, Body, MonoLabel, Mono, Display } from '../../../src/ui/core/Typography';

export default function SubmitDisputeScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  
  const params = useLocalSearchParams<{
    sessionId?: string;
    eventId?: string;
    title?: string;
  }>();

  const sessionId = params.sessionId || '';
  const eventTitle = params.title || 'CLASSROOM SESSION';

  const [reason, setReason] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { mutate: submitDispute, isPending } = useSubmitDispute();

  const isValid = reason.trim().length >= 10;

  const handleSubmit = () => {
    if (!isValid || isPending) return;
    setErrorMessage(null);

    submitDispute(
      {
        session_id: sessionId,
        reason: reason.trim(),
      },
      {
        onSuccess: (data) => {
          router.replace({
            pathname: '/disputes/submitted',
            params: {
              disputeId: data.id,
              eventTitle,
              sessionId,
            },
          });
        },
        onError: (err: any) => {
          let userMsg = err.message || 'Failed to submit dispute claim.';

          if (userMsg.includes('ATTENDANCE_ALREADY_RECORDED')) {
            userMsg = 'A dispute or attendance record for this session has already been submitted.';
          } else if (userMsg.includes('DISPUTE_WINDOW_EXPIRED')) {
            userMsg = 'The 24-hour dispute window for this session has expired.';
          } else if (userMsg.includes('SESSION_CLOSED')) {
            userMsg = 'The attendance session is closed or no longer accepts claims.';
          }

          setErrorMessage(userMsg);
        },
      }
    );
  };

  const styles = useMemo(() => StyleSheet.create({
    keyboardAvoid: {
      flex: 1,
    },
    mainContainer: {
      flex: 1,
      paddingHorizontal: theme.spacing.base,
      paddingBottom: 24,
      justifyContent: 'space-between',
    },
    header: {
      height: 56,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.borderHairline,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginHorizontal: -theme.spacing.base,
      paddingHorizontal: theme.spacing.base,
      backgroundColor: theme.colors.surface,
    },
    backBtn: {
      paddingVertical: 6,
      paddingRight: 12,
    },
    backBtnText: {
      color: theme.colors.error,
    },
    headerTitle: {
      color: theme.colors.onSurface,
      letterSpacing: 1,
    },
    contextCard: {
      backgroundColor: theme.colors.surfaceContainerLow,
      borderColor: theme.colors.borderHairline,
      borderWidth: 1,
      padding: 16,
      marginTop: 16,
    },
    contextCardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    contextLabel: {
      color: theme.colors.onSurfaceVariant,
      letterSpacing: 0.5,
    },
    eventTitle: {
      fontSize: 16,
      color: theme.colors.onSurface,
      lineHeight: 20,
    },
    formContainer: {
      flex: 1,
      marginTop: 16,
    },
    formLabelRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    inputLabel: {
      color: theme.colors.onSurface,
      letterSpacing: 0.5,
    },
    charCount: {
      fontSize: 10,
      color: theme.colors.onSurfaceVariant,
    },
    textArea: {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.borderHairline,
      borderWidth: 1,
      padding: 14,
      fontFamily: theme.typography.interRegular,
      fontSize: 13,
      color: theme.colors.onSurface,
      height: 140,
    },
    validationText: {
      fontSize: 10,
      color: theme.colors.error,
      marginTop: 6,
    },
    errorBox: {
      backgroundColor: theme.colors.errorContainer,
      borderColor: theme.colors.error,
      borderWidth: 1,
      padding: 12,
      marginTop: 12,
      gap: 6,
    },
    errorText: {
      color: theme.colors.onErrorContainer,
    },
    actionContainer: {
      gap: 10,
    },
    disclaimerText: {
      fontSize: 10,
      color: theme.colors.onSurfaceVariant,
      textAlign: 'center',
    },
  }), [theme]);

  return (
    <MobileShell title="SUBMIT DISPUTE" scrollable={false}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.mainContainer}>
            {/* Header */}
            <View style={styles.header}>
              <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
                <MonoLabel style={styles.backBtnText}>CANCEL</MonoLabel>
              </TouchableOpacity>
              <MonoLabel style={styles.headerTitle}>SUBMIT DISPUTE</MonoLabel>
              <View style={{ width: 60 }} />
            </View>

            {/* Context Card */}
            <View style={styles.contextCard}>
              <View style={styles.contextCardHeader}>
                <MonoLabel style={styles.contextLabel}>TARGET SESSION</MonoLabel>
                <StatusBadge status={`#${sessionId.slice(0, 8).toUpperCase() || 'UNKNOWN'}`} type="default" />
              </View>
              <Title style={styles.eventTitle}>{eventTitle}</Title>
            </View>

            {/* Form Area */}
            <View style={styles.formContainer}>
              <View style={styles.formLabelRow}>
                <MonoLabel style={styles.inputLabel}>REASON FOR DISPUTE</MonoLabel>
                <Mono style={styles.charCount}>{reason.length}/500 CHARS</Mono>
              </View>

              <TextInput
                style={styles.textArea}
                multiline
                numberOfLines={5}
                placeholder="Describe why your attendance failed to record (e.g. Present in room, scan camera timeout, geofence sync error)..."
                placeholderTextColor={theme.colors.onSurfaceVariant}
                value={reason}
                onChangeText={(val) => {
                  if (val.length <= 500) setReason(val);
                }}
                textAlignVertical="top"
              />

              {reason.length > 0 && !isValid && (
                <Mono style={styles.validationText}>Reason must be at least 10 characters long.</Mono>
              )}

              {errorMessage && (
                <View style={styles.errorBox}>
                  <StatusBadge status="[SUBMISSION ERROR]" type="error" />
                  <Body style={styles.errorText}>{errorMessage}</Body>
                </View>
              )}
            </View>

            {/* Submit Action */}
            <View style={styles.actionContainer}>
              <Button
                title={isPending ? 'SUBMITTING CLAIM...' : 'SUBMIT ATTENDANCE DISPUTE'}
                variant="primary"
                onPress={handleSubmit}
                loading={isPending}
                disabled={!isValid || isPending}
              />
              <Mono style={styles.disclaimerText}>
                Disputes are sent directly to course instructors and recorded in audit logs.
              </Mono>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </MobileShell>
  );
}
