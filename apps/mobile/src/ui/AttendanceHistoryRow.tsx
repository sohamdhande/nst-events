import React, { useMemo } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { useAppTheme } from '../store/theme-store';
import { MonoLabel, Title, Mono } from './core/Typography';
import { AttendanceRecordItem } from '../hooks/use-attendance-history';

interface AttendanceHistoryRowProps {
  item: AttendanceRecordItem;
  onPress: () => void;
}

export const AttendanceHistoryRow: React.FC<AttendanceHistoryRowProps> = ({ item, onPress }) => {
  const theme = useAppTheme();
  
  const eventTitle = item.session?.event?.title || item.session?.title || 'GENERAL ATTENDANCE';
  const sessionTitle = item.session?.title || '';
  
  const formattedDate = new Date(item.markedAt).toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
  }).toUpperCase();
  
  const formattedTime = new Date(item.markedAt).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).toUpperCase();

  const isPresent = item.status === 'PRESENT';

  const styles = useMemo(() => StyleSheet.create({
    cardContainer: {
      paddingVertical: 12,
      borderWidth: 1,
      borderColor: theme.colors.borderHairline,
      paddingHorizontal: 12,
      marginBottom: 8,
      backgroundColor: theme.colors.surfaceContainerLow,
    },
    statusRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    statusText: {
      fontSize: 12,
      letterSpacing: 1,
    },
    statusPresent: {
      color: theme.colors.primary,
    },
    statusOther: {
      color: theme.colors.onSurfaceVariant,
    },
    checkIcon: {
      color: theme.colors.primary,
    },
    eventTitle: {
      fontSize: 14,
      marginBottom: 4,
    },
    sessionMeta: {
      fontSize: 10,
      marginBottom: 4,
    },
    dateText: {
      fontSize: 10,
    },
    bottomRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      marginTop: 4,
    },
    chevron: {
      color: theme.colors.outline,
    },
  }), [theme]);

  return (
    <TouchableOpacity style={styles.cardContainer} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.statusRow}>
        <MonoLabel style={[styles.statusText, isPresent ? styles.statusPresent : styles.statusOther]}>
          {item.status}
        </MonoLabel>
        <MonoLabel style={styles.checkIcon}>{isPresent ? '✓' : ''}</MonoLabel>
      </View>
      <Title style={styles.eventTitle} numberOfLines={1}>
        {item.session?.event?.title ? `EVENT · ${eventTitle}` : eventTitle}
      </Title>
      {!!sessionTitle && sessionTitle !== eventTitle && (
        <Mono style={styles.sessionMeta} numberOfLines={1}>
          SESSION · {sessionTitle}
        </Mono>
      )}
      <View style={styles.bottomRow}>
        <Mono style={styles.dateText}>{formattedDate} · {formattedTime}</Mono>
        <MonoLabel style={styles.chevron}>→</MonoLabel>
      </View>
    </TouchableOpacity>
  );
};
