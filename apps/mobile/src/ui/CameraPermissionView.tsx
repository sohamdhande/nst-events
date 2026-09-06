import React, { useMemo } from 'react';
import { View, StyleSheet, TouchableOpacity, SafeAreaView, StatusBar, Linking } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useAppTheme } from '../store/theme-store';
import { Title, Body, MonoLabel, Mono } from './core/Typography';

interface CameraPermissionViewProps {
  onRequestPermission: () => void;
  onCancel?: () => void;
}

export const CameraPermissionView: React.FC<CameraPermissionViewProps> = ({
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
          <View style={styles.header}>
            <View style={styles.headerBadge}>
              <View style={styles.pingDot} />
              <MonoLabel style={styles.headerMonoText}>NST EVENTS // PERMISSION</MonoLabel>
            </View>
            <Mono style={styles.reqId}>ID-CAM-001</Mono>
          </View>

          <View style={styles.viewfinderBox}>
            <View style={styles.reticleFrame}>
              <View style={[styles.cornerBracket, styles.topLeft]} />
              <View style={[styles.cornerBracket, styles.topRight]} />
              <View style={[styles.cornerBracket, styles.bottomLeft]} />
              <View style={[styles.cornerBracket, styles.bottomRight]} />
              <MaterialIcons name="camera-alt" size={32} color={theme.colors.secondary} />
            </View>
          </View>

          <View style={styles.contentSection}>
            <MonoLabel style={styles.sectionTag}>CAMERA ACCESS REQUIRED</MonoLabel>
            <Title style={styles.title}>Enable Camera</Title>
            <Body style={styles.body}>
              The camera is used exclusively to scan dynamic session QR codes projected in classroom auditoriums during active attendance windows.
            </Body>
          </View>

          <View style={styles.checklistCard}>
            <View style={styles.checkRow}>
              <MonoLabel style={styles.checkIcon}>[✓]</MonoLabel>
              <Body style={styles.checkText}>Optical QR recognition only</Body>
              <MonoLabel style={styles.checkTag}>READY</MonoLabel>
            </View>
            <View style={styles.checkRow}>
              <MonoLabel style={styles.checkIcon}>[✓]</MonoLabel>
              <Body style={styles.checkText}>Zero image storage or cloud upload</Body>
              <MonoLabel style={styles.checkTag}>ISOLATED</MonoLabel>
            </View>
            <View style={styles.checkRow}>
              <MonoLabel style={styles.checkIcon}>[✓]</MonoLabel>
              <Body style={styles.checkText}>Local viewfinder processing only</Body>
              <MonoLabel style={styles.checkTag}>RAM_ONLY</MonoLabel>
            </View>
          </View>
        </View>

        <View style={styles.actionSection}>
          <TouchableOpacity
            style={[styles.mainBtn, { backgroundColor: theme.colors.primary, justifyContent: 'center', alignItems: 'center' }]}
            onPress={onRequestPermission}
            activeOpacity={0.9}
          >
            <MonoLabel style={{ color: theme.colors.onPrimary }}>GRANT CAMERA ACCESS</MonoLabel>
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
