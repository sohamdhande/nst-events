import React, { useMemo } from 'react';
import { View, StyleSheet, TouchableOpacity, SafeAreaView } from 'react-native';
import { useAppTheme } from '../store/theme-store';
import { MonoLabel, Title } from './core/Typography';

interface ScannerOverlayProps {
  onClose: () => void;
  onToggleTorch?: () => void;
  torchActive?: boolean;
}

export const ScannerOverlay: React.FC<ScannerOverlayProps> = ({
  onClose,
  onToggleTorch,
  torchActive = false,
}) => {
  const theme = useAppTheme();

  const styles = useMemo(() => StyleSheet.create({
    container: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      justifyContent: 'space-between',
    },
    topHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: theme.spacing.base,
      paddingTop: theme.spacing.md,
      paddingBottom: theme.spacing.sm,
      backgroundColor: 'rgba(9, 9, 11, 0.75)',
    },
    headerLeft: {
      gap: 2,
    },
    modeTag: {
      color: theme.colors.onSurfaceVariant,
    },
    headerTitle: {
      fontSize: 16,
      color: '#FFFFFF',
      textTransform: 'uppercase',
    },
    headerRight: {
      flexDirection: 'row',
      gap: 8,
    },
    iconBtn: {
      width: 36,
      height: 36,
      backgroundColor: 'rgba(255, 255, 255, 0.15)',
      borderRadius: 4,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconText: {
      color: '#FFFFFF',
    },
    reticleContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      marginVertical: 'auto',
    },
    reticleBox: {
      width: 250,
      height: 250,
      position: 'relative',
    },
    corner: {
      position: 'absolute',
      width: 24,
      height: 24,
      borderColor: '#FFFFFF',
    },
    topLeft: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3 },
    topRight: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3 },
    bottomLeft: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3 },
    bottomRight: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3 },
    reticleInstruction: {
      color: '#FFFFFF',
      marginTop: 20,
      backgroundColor: 'rgba(9, 9, 11, 0.75)',
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
  }), [theme]);

  return (
    <SafeAreaView style={styles.container} pointerEvents="box-none">
      <View style={styles.topHeader}>
        <View style={styles.headerLeft}>
          <MonoLabel style={styles.modeTag}>NST EVENTS</MonoLabel>
          <Title style={styles.headerTitle}>Scan Attendance QR</Title>
        </View>
        <View style={styles.headerRight}>
          {onToggleTorch && (
            <TouchableOpacity style={styles.iconBtn} onPress={onToggleTorch}>
              <MonoLabel style={styles.iconText}>{torchActive ? '⚡ ON' : '⚡ OFF'}</MonoLabel>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.iconBtn} onPress={onClose}>
            <MonoLabel style={styles.iconText}>✕</MonoLabel>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.reticleContainer} pointerEvents="none">
        <View style={styles.reticleBox}>
          <View style={[styles.corner, styles.topLeft]} />
          <View style={[styles.corner, styles.topRight]} />
          <View style={[styles.corner, styles.bottomLeft]} />
          <View style={[styles.corner, styles.bottomRight]} />
        </View>
        <MonoLabel style={styles.reticleInstruction}>ALIGN QR CODE WITHIN RETICLE</MonoLabel>
      </View>
    </SafeAreaView>
  );
};
