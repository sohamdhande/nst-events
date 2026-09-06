import React, { useMemo } from 'react';
import { TouchableOpacity, ActivityIndicator, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { useAppTheme } from '../store/theme-store';
import { MonoLabel } from './core/Typography';

export interface ButtonProps {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
  accessibilityLabel?: string;
  accessibilityRole?: 'button' | 'link';
  style?: StyleProp<ViewStyle>;
}

export const Button = ({ 
  title, 
  onPress, 
  disabled, 
  loading, 
  variant = 'primary', 
  accessibilityLabel, 
  accessibilityRole = 'button',
  style
}: ButtonProps) => {
  const theme = useAppTheme();

  const styles = useMemo(() => StyleSheet.create({
    base: {
      height: 48,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: theme.spacing.base,
      borderWidth: 1,
    },
    primary: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    primaryText: {
      color: theme.colors.onPrimary,
    },
    secondary: {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.outlineVariant,
    },
    secondaryText: {
      color: theme.colors.onSurface,
    },
    danger: {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.error,
    },
    dangerText: {
      color: theme.colors.error,
    },
    disabled: {
      backgroundColor: theme.colors.surfaceContainerHighest,
      borderColor: theme.colors.outlineVariant,
    },
    disabledText: {
      color: theme.colors.outline,
    }
  }), [theme]);

  let containerStyle = styles.primary;
  let textStyle = styles.primaryText;

  if (variant === 'secondary') {
    containerStyle = styles.secondary;
    textStyle = styles.secondaryText;
  } else if (variant === 'danger') {
    containerStyle = styles.danger;
    textStyle = styles.dangerText;
  }

  return (
    <TouchableOpacity 
      onPress={onPress} 
      disabled={disabled || loading}
      accessibilityLabel={accessibilityLabel || title}
      accessibilityRole={accessibilityRole}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      style={[
        styles.base, 
        containerStyle, 
        disabled && styles.disabled,
        style
      ]}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' || variant === 'danger' ? theme.colors.surface : theme.colors.primary} />
      ) : (
        <MonoLabel style={[textStyle, disabled && styles.disabledText]}>{title}</MonoLabel>
      )}
    </TouchableOpacity>
  );
};
