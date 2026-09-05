import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, StatusBar, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { theme } from '../../src/ui/theme';
import { Button } from '../../src/ui/Button';
import { useAuthStore } from '../../src/store/auth';
import { apiClient } from '../../src/infrastructure/api';

import { GoogleSignin, isErrorWithCode, statusCodes } from '@react-native-google-signin/google-signin';

GoogleSignin.configure({
  webClientId: '590987407822-nqlm9puo59u6kjotfp3eqsliq3imkr2s.apps.googleusercontent.com', // from API .env
  iosClientId: 'YOUR_IOS_CLIENT_ID', // Replace with iOS Client ID
  hostedDomain: 'adypu.edu.in',
});

export default function LoginGatewayScreen() {
  const router = useRouter();
  const setSession = useAuthStore((state) => state.setSession);
  const [domainError, setDomainError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setLoading(true);
    setDomainError(null);

    try {
      await GoogleSignin.hasPlayServices();
      const userInfo = await GoogleSignin.signIn();
      const idToken = userInfo.data?.idToken || (userInfo as any).idToken;

      if (!idToken) {
        setDomainError('No ID token received from Google');
        return;
      }

      console.log('[Auth] Attempting token exchange with id_token');
      // Send id_token directly to backend
      const exchangeRes: any = await apiClient('/auth/mobile/login-id-token', {
        method: 'POST',
        body: JSON.stringify({ id_token: idToken }),
      });

      if (!exchangeRes?.access_token || !exchangeRes?.refresh_token) {
        setDomainError('Token exchange failed');
        return;
      }

      // Fetch user profile to resolve user ID and global role
      const userProfile: any = await apiClient('/v1/users/me', {
        headers: { Authorization: `Bearer ${exchangeRes.access_token}` },
      });

      if (userProfile?.id) {
        console.log('[Auth] Authentication handshake complete for user ID:', userProfile.id);
        await setSession(userProfile.id, exchangeRes.access_token, exchangeRes.refresh_token);

        if (userProfile.global_role === 'STUDENT') {
          router.replace('/(app)');
        } else {
          router.replace('/(app)');
        }
        return;
      } else {
         setDomainError('Failed to verify user profile');
         return;
      }
    } catch (err: any) {
      console.error('[Auth] OAuth initiation error:', err);
      if (isErrorWithCode(err) && err.code === statusCodes.SIGN_IN_CANCELLED) {
        console.log('[Auth] User cancelled OAuth flow');
      } else {
        setDomainError(err?.message || 'Failed to complete Google authentication');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={theme.colors.surface} />
      <View style={styles.container}>
        {/* Header Metadata */}
        <View style={styles.header}>
          <View style={styles.badgeRow}>
            <View style={styles.pingDot} />
            <Text style={styles.headerMonoText}>AUTH GATEWAY // NST-NET</Text>
          </View>
          <View style={styles.statusPill}>
            <Text style={styles.statusPillText}>BLR-CAMPUS-01</Text>
          </View>
        </View>

        {/* Editorial Section */}
        <View style={styles.bodySection}>
          <View style={styles.sectionTagRow}>
            <Text style={styles.sectionTagText}>IDENTITY VERIFICATION</Text>
            <Text style={styles.sectionTagCode}>// SEC-02</Text>
          </View>

          <Text style={styles.headline}>Access Attendance Enclave</Text>

          <Text style={styles.bodyText}>
            Use your institutional <Text style={styles.monoHighlight}>@adypu.edu.in</Text> or <Text style={styles.monoHighlight}>@newtonschool.co</Text> identity to synchronize attendance records, session logs, and dispute claims.
          </Text>

          {/* Ledger Identity Matrix Card */}
          <View style={styles.matrixCard}>
            <View style={styles.matrixHeader}>
              <Text style={styles.matrixHeaderTag}>SESSION HANDSHAKE MATRIX</Text>
              <Text style={styles.matrixHeaderStatus}>READY FOR SSO</Text>
            </View>

            <View style={styles.matrixGrid}>
              <View style={styles.matrixItem}>
                <Text style={styles.matrixItemLabel}>CLEARANCE</Text>
                <Text style={styles.matrixItemValue}>LEVEL-03</Text>
              </View>
              <View style={styles.matrixItem}>
                <Text style={styles.matrixItemLabel}>CLUSTER</Text>
                <Text style={styles.matrixItemValue}>AI-DEV-ENG</Text>
              </View>
              <View style={styles.matrixItem}>
                <Text style={styles.matrixItemLabel}>DEVICE BOUND</Text>
                <Text style={styles.matrixItemValueActive}>ACTIVE</Text>
              </View>
            </View>
          </View>

          {domainError && (
            <View style={styles.errorBox}>
              <Text style={styles.errorTitle}>INSTITUTIONAL DOMAIN NOT ALLOWED</Text>
              <Text style={styles.errorBody}>{domainError}</Text>
              <TouchableOpacity style={styles.errorBtn} onPress={() => setDomainError(null)}>
                <Text style={styles.errorBtnText}>TRY A DIFFERENT ACCOUNT</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Action Enclosure */}
        <View style={styles.footer}>
          <Button
            title="CONTINUE WITH GOOGLE"
            onPress={handleGoogleLogin}
            loading={loading}
            variant="primary"
            style={styles.ctaButton}
          />

          <View style={styles.noticeBox}>
            <Text style={styles.noticeText}>RESTRICTED TO ENROLLED NST STUDENTS & FACULTY</Text>
            <Text style={styles.noticeSub}>SINGLE DEVICE BOUND // HARDWARE KEY VERIFIED</Text>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.surface,
  },
  container: {
    flex: 1,
    paddingHorizontal: theme.spacing.base,
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderHairline,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.secondary,
  },
  headerMonoText: {
    fontFamily: theme.typography.monoBold,
    fontSize: 10,
    letterSpacing: 0.8,
    color: theme.colors.primary,
    textTransform: 'uppercase',
  },
  statusPill: {
    backgroundColor: theme.colors.surfaceContainerHigh,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 2,
  },
  statusPillText: {
    fontFamily: theme.typography.monoBold,
    fontSize: 10,
    letterSpacing: 0.8,
    color: theme.colors.primary,
  },
  bodySection: {
    marginVertical: 'auto',
    width: '100%',
    gap: theme.spacing.md,
  },
  sectionTagRow: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  sectionTagText: {
    fontFamily: theme.typography.monoBold,
    fontSize: 10,
    color: theme.colors.secondary,
    letterSpacing: 0.8,
  },
  sectionTagCode: {
    fontFamily: theme.typography.monoMedium,
    fontSize: 10,
    color: theme.colors.onSurfaceVariant,
  },
  headline: {
    fontFamily: theme.typography.syneBold,
    fontSize: 30,
    lineHeight: 34,
    color: theme.colors.primary,
    letterSpacing: -0.5,
  },
  bodyText: {
    fontFamily: theme.typography.interRegular,
    fontSize: 14,
    lineHeight: 20,
    color: theme.colors.onSurfaceVariant,
  },
  monoHighlight: {
    fontFamily: theme.typography.monoMedium,
    color: theme.colors.primary,
    backgroundColor: theme.colors.surfaceContainerHigh,
  },
  matrixCard: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.borderHairline,
    padding: theme.spacing.base,
    marginTop: 4,
  },
  matrixHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderHairline,
    paddingBottom: 6,
    marginBottom: 10,
  },
  matrixHeaderTag: {
    fontFamily: theme.typography.monoBold,
    fontSize: 10,
    color: theme.colors.onSurfaceVariant,
  },
  matrixHeaderStatus: {
    fontFamily: theme.typography.monoBold,
    fontSize: 10,
    color: theme.colors.secondary,
  },
  matrixGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  matrixItem: {
    flex: 1,
    backgroundColor: theme.colors.surfaceContainerLow,
    padding: 8,
    borderWidth: 1,
    borderColor: theme.colors.outlineVariant,
  },
  matrixItemLabel: {
    fontFamily: theme.typography.monoBold,
    fontSize: 9,
    color: theme.colors.onSurfaceVariant,
  },
  matrixItemValue: {
    fontFamily: theme.typography.monoBold,
    fontSize: 11,
    color: theme.colors.primary,
    marginTop: 2,
  },
  matrixItemValueActive: {
    fontFamily: theme.typography.monoBold,
    fontSize: 11,
    color: theme.colors.secondary,
    marginTop: 2,
  },
  errorBox: {
    backgroundColor: theme.colors.errorContainer,
    borderWidth: 1,
    borderColor: theme.colors.error,
    padding: theme.spacing.md,
    marginTop: 8,
  },
  errorTitle: {
    fontFamily: theme.typography.monoBold,
    fontSize: 11,
    color: theme.colors.onErrorContainer,
  },
  errorBody: {
    fontFamily: theme.typography.interRegular,
    fontSize: 12,
    color: theme.colors.onErrorContainer,
    marginTop: 4,
  },
  errorBtn: {
    marginTop: 8,
    backgroundColor: theme.colors.error,
    paddingVertical: 8,
    alignItems: 'center',
  },
  errorBtnText: {
    fontFamily: theme.typography.interSemiBold,
    fontSize: 11,
    color: theme.colors.onError,
  },
  footer: {
    gap: theme.spacing.md,
  },
  ctaButton: {
    height: 56,
  },
  noticeBox: {
    alignItems: 'center',
    gap: 2,
  },
  noticeText: {
    fontFamily: theme.typography.monoBold,
    fontSize: 10,
    color: theme.colors.onSurfaceVariant,
    textTransform: 'uppercase',
  },
  noticeSub: {
    fontFamily: theme.typography.monoMedium,
    fontSize: 9,
    color: theme.colors.outline,
    textTransform: 'uppercase',
  },
});
