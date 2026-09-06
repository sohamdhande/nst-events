import React, { useMemo } from 'react';
import { Text, TextProps, StyleSheet } from 'react-native';
import { useAppTheme } from '../../store/theme-store';

interface BaseTextProps extends TextProps {
  children: React.ReactNode;
}

export function Display({ children, style, ...props }: BaseTextProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return <Text style={[styles.display, style]} {...props}>{children}</Text>;
}

export function Title({ children, style, ...props }: BaseTextProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return <Text style={[styles.title, style]} {...props}>{children}</Text>;
}

export function Body({ children, style, ...props }: BaseTextProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return <Text style={[styles.body, style]} {...props}>{children}</Text>;
}

export function Mono({ children, style, ...props }: BaseTextProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return <Text style={[styles.mono, style]} {...props}>{children}</Text>;
}

export function MonoLabel({ children, style, ...props }: BaseTextProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return <Text style={[styles.monoLabel, style]} {...props}>{children}</Text>;
}

const makeStyles = (theme: ReturnType<typeof useAppTheme>) => StyleSheet.create({
  display: {
    fontFamily: theme.typography.syneExtraBold,
    fontSize: 48,
    lineHeight: 52,
    color: theme.colors.onSurface,
    textTransform: 'uppercase',
  },
  title: {
    fontFamily: theme.typography.syneBold,
    fontSize: 24,
    lineHeight: 28,
    color: theme.colors.onSurface,
    textTransform: 'uppercase',
  },
  body: {
    fontFamily: theme.typography.interRegular,
    fontSize: 16,
    lineHeight: 24,
    color: theme.colors.onSurface,
  },
  mono: {
    fontFamily: theme.typography.monoRegular,
    fontSize: 14,
    lineHeight: 20,
    color: theme.colors.onSurfaceVariant,
  },
  monoLabel: {
    fontFamily: theme.typography.monoBold,
    fontSize: 12,
    letterSpacing: 1,
    color: theme.colors.onSurface,
  },
});
