import React, { useState, useMemo } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useAppTheme } from '../../src/store/theme-store';
import { StatusBadge } from '../../src/ui/core/StatusBadge';
import { Button } from '../../src/ui/Button';
import { useUserProfile } from '../../src/hooks/use-user-profile';
import { useAuthStore } from '../../src/store/auth';
import { MobileShell } from '../../src/ui/core/MobileShell';
import { Title, Body, MonoLabel, Mono, Display } from '../../src/ui/core/Typography';

export default function ProfileScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const { data: profile, isLoading } = useUserProfile();
  const clearSession = useAuthStore((state) => state.clearSession);

  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const fullName = profile?.full_name || profile?.email || 'Student Account';
  const email = profile?.email || '';
  const globalRole = profile?.global_role || 'STUDENT';
  const programCode = profile?.academic_profile?.batch?.program?.code || 'CS';
  const gradYear = profile?.academic_profile?.batch?.graduation_year || 2027;

  const handleConfirmLogout = async () => {
    setIsLoggingOut(true);
    try {
      await clearSession();
      setShowLogoutModal(false);
      router.replace('/(auth)');
    } catch {
      setIsLoggingOut(false);
    }
  };

  const styles = useMemo(() => StyleSheet.create({
    mainContainer: {
      padding: theme.spacing.base,
      gap: theme.spacing.lg,
    },
    loadingBox: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
    },
    identitySection: {
      backgroundColor: theme.colors.surfaceContainerLow,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.borderHairline,
      padding: theme.spacing.base,
    },
    identityHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
    },
    avatarBox: {
      width: 48,
      height: 48,
      backgroundColor: theme.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarInitial: {
      color: theme.colors.onPrimary,
      fontSize: 20,
    },
    identityInfo: {
      flex: 1,
      gap: 2,
    },
    studentName: {
      fontSize: 16,
      textTransform: 'uppercase',
    },
    emailText: {
      fontSize: 12,
    },
    roleText: {
      textTransform: 'uppercase',
      marginTop: 2,
    },
    clubsSection: {
      gap: theme.spacing.sm,
    },
    sectionTitle: {
      color: theme.colors.outline,
    },
    clubBadgesRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    clubBadge: {
      paddingVertical: 4,
    },
    clubBadgeText: {
      fontSize: 10,
      color: theme.colors.onSurface,
    },
    menuContainer: {
      gap: theme.spacing.sm,
    },
    menuList: {
      borderTopWidth: 1,
      borderTopColor: theme.colors.borderHairline,
    },
    menuRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.borderHairline,
    },
    menuRowLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
    },
    menuRowTitle: {
      fontFamily: theme.typography.interSemiBold,
      fontSize: 12,
    },
    menuRowArrow: {
      fontSize: 14,
      color: theme.colors.onSurfaceVariant,
    },
    bottomSection: {
      marginTop: theme.spacing.lg,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(9, 9, 11, 0.6)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
    },
    modalContent: {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.borderHairline,
      borderWidth: 1,
      borderRadius: theme.borderRadius.sm,
      padding: 20,
      width: '100%',
      gap: 12,
    },
    modalBadge: {
    },
    modalTitle: {
      fontSize: 18,
    },
    modalBody: {
      fontSize: 13,
      lineHeight: 18,
    },
    modalActions: {
      gap: 8,
      marginTop: 8,
    },
  }), [theme]);

  return (
    <MobileShell title="PROFILE">
      <View style={styles.mainContainer}>
        {isLoading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <MonoLabel>LOADING PROFILE DATA...</MonoLabel>
          </View>
        ) : (
          <>
            <View style={styles.identitySection}>
              <View style={styles.identityHeader}>
                <View style={styles.avatarBox}>
                  <Display style={styles.avatarInitial}>{fullName.charAt(0).toUpperCase()}</Display>
                </View>
                <View style={styles.identityInfo}>
                  <Title style={styles.studentName} numberOfLines={1}>{fullName.toUpperCase()}</Title>
                  <Body style={styles.emailText} numberOfLines={1}>{email}</Body>
                  <MonoLabel style={styles.roleText} numberOfLines={1}>
                    {globalRole} / {programCode} / {gradYear}
                  </MonoLabel>
                </View>
              </View>
            </View>

            {profile?.club_memberships && profile.club_memberships.length > 0 && (
              <View style={styles.clubsSection}>
                <MonoLabel style={styles.sectionTitle}>AFFILIATIONS</MonoLabel>
                <View style={styles.clubBadgesRow}>
                  {profile.club_memberships.map((m) => (
                    <View key={m.club_id} style={styles.clubBadge}>
                      <Mono style={styles.clubBadgeText}>[ {m.club_name.toUpperCase()} / {m.role} ]</Mono>
                    </View>
                  ))}
                </View>
              </View>
            )}

            <View style={styles.menuContainer}>
              <MonoLabel style={styles.sectionTitle}>ACCOUNT SETTINGS</MonoLabel>

              <View style={styles.menuList}>
                <TouchableOpacity
                  style={styles.menuRow}
                  onPress={() => router.push('/settings')}
                  activeOpacity={0.7}
                >
                  <View style={styles.menuRowLeft}>
                    <MaterialIcons name="settings" size={16} color={theme.colors.primary} />
                    <Body style={styles.menuRowTitle}>PREFERENCES</Body>
                  </View>
                  <MonoLabel style={styles.menuRowArrow}>→</MonoLabel>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.menuRow}
                  onPress={() => router.push('/notifications')}
                  activeOpacity={0.7}
                >
                  <View style={styles.menuRowLeft}>
                    <MaterialIcons name="notifications" size={16} color={theme.colors.primary} />
                    <Body style={styles.menuRowTitle}>NOTIFICATIONS</Body>
                  </View>
                  <MonoLabel style={styles.menuRowArrow}>→</MonoLabel>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.menuRow}
                  onPress={() => router.push('/history')}
                  activeOpacity={0.7}
                >
                  <View style={styles.menuRowLeft}>
                    <MaterialIcons name="history" size={16} color={theme.colors.primary} />
                    <Body style={styles.menuRowTitle}>ATTENDANCE LOGS</Body>
                  </View>
                  <MonoLabel style={styles.menuRowArrow}>→</MonoLabel>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.menuRow}
                  onPress={() => router.push('/disputes')}
                  activeOpacity={0.7}
                >
                  <View style={styles.menuRowLeft}>
                    <MaterialIcons name="assignment" size={16} color={theme.colors.primary} />
                    <Body style={styles.menuRowTitle}>CLAIMS & DISPUTES</Body>
                  </View>
                  <MonoLabel style={styles.menuRowArrow}>→</MonoLabel>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.bottomSection}>
              <Button
                title="[ LOG OUT ]"
                variant="secondary"
                onPress={() => setShowLogoutModal(true)}
              />
            </View>
          </>
        )}
      </View>

      <Modal
        visible={showLogoutModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLogoutModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <StatusBadge status="[LOGOUT CONFIRMATION]" type="error" />
            
            <Title style={styles.modalTitle}>END ACTIVE SESSION?</Title>
            
            <Body style={styles.modalBody}>
              Are you sure you want to end your active student session on this device? You will need your institutional @nst.edu.in credentials to log back in.
            </Body>

            <View style={styles.modalActions}>
              <Button
                title={isLoggingOut ? 'LOGGING OUT...' : 'CONFIRM LOGOUT'}
                variant="danger"
                onPress={handleConfirmLogout}
                loading={isLoggingOut}
                disabled={isLoggingOut}
              />
              <Button
                title="CANCEL / REMAIN LOGGED IN"
                variant="secondary"
                onPress={() => setShowLogoutModal(false)}
                disabled={isLoggingOut}
              />
            </View>
          </View>
        </View>
      </Modal>
    </MobileShell>
  );
}
