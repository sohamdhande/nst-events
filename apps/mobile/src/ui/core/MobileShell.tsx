import React, { useMemo } from 'react';
import { View, StyleSheet, StatusBar, TouchableOpacity, ScrollView, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAppTheme } from '../../store/theme-store';
import { MonoLabel } from './Typography';

interface MobileShellProps {
  children: React.ReactNode;
  title: string;
  showBackButton?: boolean;
  onBackPress?: () => void;
  scrollable?: boolean;
  refreshControl?: React.ReactElement<any>;
}

export function MobileShell({ 
  children, 
  title, 
  showBackButton = false, 
  onBackPress,
  scrollable = true,
  refreshControl
}: MobileShellProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const theme = useAppTheme();

  const handleBack = () => {
    if (onBackPress) {
      onBackPress();
    } else {
      router.back();
    }
  };

  const styles = useMemo(() => StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.colors.surface,
    },
    header: {
      paddingVertical: 12,
      paddingHorizontal: theme.spacing.base,
      flexDirection: 'row',
      alignItems: 'center',
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.borderHairline,
      backgroundColor: theme.colors.surface,
      zIndex: 10,
    },
    backBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      marginRight: theme.spacing.md,
    },
    backText: {
      color: theme.colors.primary,
    },
    titleContainer: {
      flex: 1,
    },
    brandTitle: {
      color: theme.colors.onSurfaceVariant,
    },
    container: {
      flex: 1,
    },
    content: {
      padding: theme.spacing.base,
      gap: theme.spacing.xl,
    },
  }), [theme]);

  const contentStyle = [
    styles.content,
    { paddingBottom: Math.max(insets.bottom, 12) + 80 }
  ];

  return (
    <View style={[styles.safeArea, { paddingTop: Math.max(insets.top, 8) }]}>
      <StatusBar 
        barStyle={theme.colors.surface === '#fbfbfb' ? 'dark-content' : 'light-content'} 
        backgroundColor="transparent" 
        translucent 
      />
      
      <View style={styles.header}>
        {showBackButton ? (
          <TouchableOpacity onPress={handleBack} style={styles.backBtn} activeOpacity={0.8}>
            <MonoLabel style={styles.backText}>← BACK</MonoLabel>
          </TouchableOpacity>
        ) : null}
        
        <View style={styles.titleContainer}>
          <MonoLabel style={styles.brandTitle}>
            {showBackButton ? `/   ${title.toUpperCase()}` : `NST EVENTS / ${title.toUpperCase()}`}
          </MonoLabel>
        </View>
      </View>

      {scrollable ? (
        <ScrollView 
          style={styles.container}
          contentContainerStyle={contentStyle}
          showsVerticalScrollIndicator={false}
          refreshControl={refreshControl}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.container, contentStyle]}>
          {children}
        </View>
      )}
    </View>
  );
}
