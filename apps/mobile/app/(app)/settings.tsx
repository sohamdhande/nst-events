import React, { useMemo } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Button } from '../../src/ui/Button';
import { useThemeStore, ThemeMode, useAppTheme } from '../../src/store/theme-store';
import { MobileShell } from '../../src/ui/core/MobileShell';
import { Title, Body, MonoLabel, Mono } from '../../src/ui/core/Typography';

export default function SettingsScreen() {
  const router = useRouter();
  const { mode, setMode } = useThemeStore();
  const theme = useAppTheme();

  const handleSelectMode = async (newMode: ThemeMode) => {
    await setMode(newMode);
  };

  const styles = useMemo(() => StyleSheet.create({
    sectionHeader: {
      gap: 4,
      marginBottom: theme.spacing.lg,
    },
    sectionTitle: {
      color: theme.colors.outline,
    },
    sectionDesc: {
      color: theme.colors.onSurfaceVariant,
    },
    optionsList: {
      borderTopWidth: 1,
      borderTopColor: theme.colors.borderHairline,
    },
    optionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 14,
      paddingHorizontal: theme.spacing.base,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.borderHairline,
      backgroundColor: theme.colors.surfaceContainerLow,
    },
    optionRowActive: {
      backgroundColor: theme.colors.surface,
      borderBottomColor: theme.colors.primary,
      borderBottomWidth: 2,
      borderLeftWidth: 4,
      borderLeftColor: theme.colors.primary,
    },
    optionContent: {
      gap: 2,
    },
    optionTitleActive: {
      color: theme.colors.primary,
    },
    activeIndicator: {
      color: theme.colors.primary,
    },
    spacer: {
      flex: 1,
      minHeight: 24,
    },
  }), [theme]);

  return (
    <MobileShell title="SETTINGS" showBackButton scrollable={true}>
      <View style={styles.sectionHeader}>
        <MonoLabel style={styles.sectionTitle}>APPEARANCE</MonoLabel>
        <Body style={styles.sectionDesc}>Choose how NST Events should appear.</Body>
      </View>

      <View style={styles.optionsList}>
        <TouchableOpacity
          style={[styles.optionRow, mode === 'light' && styles.optionRowActive]}
          onPress={() => handleSelectMode('light')}
          activeOpacity={0.8}
        >
          <View style={styles.optionContent}>
            <Title style={mode === 'light' ? styles.optionTitleActive : undefined}>LIGHT</Title>
            <Mono>High contrast</Mono>
          </View>
          {mode === 'light' && <MonoLabel style={styles.activeIndicator}>[SELECTED]</MonoLabel>}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.optionRow, mode === 'dark' && styles.optionRowActive]}
          onPress={() => handleSelectMode('dark')}
          activeOpacity={0.8}
        >
          <View style={styles.optionContent}>
            <Title style={mode === 'dark' ? styles.optionTitleActive : undefined}>DARK</Title>
            <Mono>Kinetic Noir</Mono>
          </View>
          {mode === 'dark' && <MonoLabel style={styles.activeIndicator}>[SELECTED]</MonoLabel>}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.optionRow, mode === 'system' && styles.optionRowActive]}
          onPress={() => handleSelectMode('system')}
          activeOpacity={0.8}
        >
          <View style={styles.optionContent}>
            <Title style={mode === 'system' ? styles.optionTitleActive : undefined}>SYSTEM</Title>
            <Mono>Follow device</Mono>
          </View>
          {mode === 'system' && <MonoLabel style={styles.activeIndicator}>[SELECTED]</MonoLabel>}
        </TouchableOpacity>
      </View>

      <View style={styles.spacer} />

      <Button
        title="← RETURN TO PROFILE"
        variant="secondary"
        onPress={() => router.back()}
      />
    </MobileShell>
  );
}
