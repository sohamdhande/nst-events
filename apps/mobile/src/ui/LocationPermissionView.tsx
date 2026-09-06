import React, { useMemo } from 'react';
import { View, StyleSheet, SafeAreaView, StatusBar, TouchableOpacity, Linking } from 'react-native';
import { useAppTheme } from '../store/theme-store';
import { Title, Body, MonoLabel, Mono, Display } from './core/Typography';

interface LocationPermissionViewProps {
  onRequestPermission: () => void;
  onCancel?: () => void;
}

export const LocationPermissionView: React.FC<LocationPermissionViewProps> = ({
  onRequestPermission,
  onCancel,
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
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingBottom: theme.spacing.sm,
    },
    headerBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: theme.colors.surfaceContainerHigh,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 2,
    },
    pingDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: theme.colors.secondary,
    },
    headerMonoText: {
      color: theme.colors.primary,
    },
    reqId: {
      color: theme.colors.onSurfaceVariant,
    },
    viewfinderBox: {
      height: 200,
      backgroundColor: theme.colors.surfaceContainerLow,
      borderWidth: 1,
      borderColor: theme.colors.outlineVariant,
      alignItems: 'center',
      justifyContent: 'center',
      marginVertical: 24,
    },
    reticleFrame: {
      width: 130,
      height: 130,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cornerBracket: {
      position: 'absolute',
      width: 16,
      height: 16,
      borderColor: theme.colors.secondary,
    },
    topLeft: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3 },
    topRight: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3 },
    bottomLeft: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3 },
    bottomRight: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3 },
    locationCircle: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: theme.colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.colors.borderHairline,
    },
    locationIconText: {
      fontSize: 24,
    },
    contentSection: {
      gap: 8,
      marginVertical: theme.spacing.sm,
    },
    sectionTag: {
      color: theme.colors.secondary,
      letterSpacing: 0.8,
    },
    title: {
      fontSize: 22,
      color: theme.colors.primary,
    },
    body: {
      color: theme.colors.onSurfaceVariant,
    },
    checklistCard: {
      backgroundColor: theme.colors.surfaceContainerLow,
      borderWidth: 1,
      borderColor: theme.colors.outlineVariant,
      padding: theme.spacing.sm,
      gap: 8,
      marginTop: 4,
    },
    checkRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    checkIcon: {
      color: theme.colors.secondary,
      marginRight: 6,
    },
    checkText: {
      color: theme.colors.primary,
      flex: 1,
    },
    checkTag: {
      color: theme.colors.onSurfaceVariant,
    },
    actionSection: {
      gap: theme.spacing.sm,
    },
    mainBtn: {
      height: 52,
      borderRadius: theme.borderRadius.sm,
    },
    settingsBtn: {
      alignItems: 'center',
      paddingVertical: 6,
    },
    settingsText: {
      color: theme.colors.onSurfaceVariant,
    },
    cancelBtn: {
      alignItems: 'center',
      paddingVertical: 4,
    },
    cancelText: {
      color: theme.colors.error,
    },
  }), [theme]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle={theme.mode === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={theme.colors.surface} />
      <View style={styles.container}>
        <View>
          {/* Top Header */}
          <View style={styles.header}>
            <View style={styles.headerBadge}>
              <View style={styles.pingDot} />
              <MonoLabel style={styles.headerMonoText}>[PERMISSION_GATE // SYS_GEO]</MonoLabel>
            </View>
            <Mono style={styles.reqId}>REQ_ID: 0x91F4</Mono>
          </View>

          {/* Reticle / Radar Viewfinder Mockup */}
          <View style={styles.viewfinderBox}>
            <View style={styles.reticleFrame}>
              <View style={[styles.cornerBracket, styles.topLeft]} />
              <View style={[styles.cornerBracket, styles.topRight]} />
              <View style={[styles.cornerBracket, styles.bottomLeft]} />
              <View style={[styles.cornerBracket, styles.bottomRight]} />
              <View style={styles.locationCircle}>
                <Display style={styles.locationIconText}>📍</Display>
              </View>
            </View>
          </View>

          {/* Rationale Content */}
          <View style={styles.contentSection}>
            <MonoLabel style={styles.sectionTag}>LOCATION LINK // GEOFENCE VERIFICATION</MonoLabel>
            <Title style={styles.title}>Foreground Location Required</Title>
            <Body style={styles.body}>
              High-accuracy foreground location is acquired to verify presence inside the authorized auditorium geofence perimeter during QR verification.
            </Body>
          </View>

          <View style={styles.checklistCard}>
            <View style={styles.checkRow}>
              <MonoLabel style={styles.checkIcon}>[✓]</MonoLabel>
              <Body style={styles.checkText}>Foreground location acquisition only</Body>
              <MonoLabel style={styles.checkTag}>NO_BG_TRACKING</MonoLabel>
            </View>
            <View style={styles.checkRow}>
              <MonoLabel style={styles.checkIcon}>[✓]</MonoLabel>
              <Body style={styles.checkText}>Authoritative backend geofence check</Body>
              <MonoLabel style={styles.checkTag}>SERVER_AUTH</MonoLabel>
            </View>
            <View style={styles.checkRow}>
              <MonoLabel style={styles.checkIcon}>[✓]</MonoLabel>
              <Body style={styles.checkText}>High-accuracy GPS fix</Body>
              <MonoLabel style={styles.checkTag}>HIGH_ACCURACY</MonoLabel>
            </View>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actionSection}>
          <TouchableOpacity
            style={[styles.mainBtn, { backgroundColor: theme.colors.primary, justifyContent: 'center', alignItems: 'center' }]}
            onPress={onRequestPermission}
            activeOpacity={0.9}
          >
            <MonoLabel style={{ color: theme.colors.onPrimary }}>ENABLE LOCATION SERVICES</MonoLabel>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.settingsBtn}
            onPress={() => Linking.openSettings()}
          >
            <MonoLabel style={styles.settingsText}>DENIED / OPEN SYSTEM SETTINGS</MonoLabel>
          </TouchableOpacity>
          {onCancel && (
            <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
              <MonoLabel style={styles.cancelText}>CANCEL SCAN</MonoLabel>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
};
