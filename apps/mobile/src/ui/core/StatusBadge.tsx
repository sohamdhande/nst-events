import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { useAppTheme } from '../../store/theme-store';
import { MonoLabel } from './Typography';

interface StatusBadgeProps {
  status: string;
  type?: 'default' | 'success' | 'warning' | 'error' | 'info';
}

export function StatusBadge({ status, type = 'default' }: StatusBadgeProps) {
  const theme = useAppTheme();

  const styles = useMemo(() => StyleSheet.create({
    badge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderWidth: 1,
      alignSelf: 'flex-start',
    },
    text: {
      fontSize: 9, // Slightly smaller than standard MonoLabel
    },
    
    defaultContainer: {
      backgroundColor: theme.colors.surfaceContainerHighest,
      borderColor: theme.colors.outlineVariant,
    },
    defaultText: {
      color: theme.colors.onSurfaceVariant,
    },

    successContainer: {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.primaryFixed,
    },
    successText: {
      color: theme.colors.primaryFixed,
    },

    warningContainer: {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.error, // Replaced hardcoded yellow
    },
    warningText: {
      color: theme.colors.error,
    },

    errorContainer: {
      backgroundColor: theme.colors.errorContainer,
      borderColor: theme.colors.error,
    },
    errorText: {
      color: theme.colors.onErrorContainer,
    },

    infoContainer: {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.secondary,
    },
    infoText: {
      color: theme.colors.secondary,
    }
  }), [theme]);

  let containerStyle = styles.defaultContainer;
  let textStyle = styles.defaultText;

  switch (type) {
    case 'success':
      containerStyle = styles.successContainer;
      textStyle = styles.successText;
      break;
    case 'warning':
      containerStyle = styles.warningContainer;
      textStyle = styles.warningText;
      break;
    case 'error':
      containerStyle = styles.errorContainer;
      textStyle = styles.errorText;
      break;
    case 'info':
      containerStyle = styles.infoContainer;
      textStyle = styles.infoText;
      break;
  }

  return (
    <View style={[styles.badge, containerStyle]}>
      <MonoLabel style={[styles.text, textStyle]}>{status}</MonoLabel>
    </View>
  );
}
