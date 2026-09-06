import React, { useMemo } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { useAppTheme } from '../store/theme-store';
import { DisputeStatusBadge } from './DisputeStatusBadge';
import { AttendanceDisputeItem } from '../hooks/use-disputes';
import { MonoLabel, Title, Body, Mono } from './core/Typography';

interface DisputeRowProps {
  item: AttendanceDisputeItem;
  onPress: () => void;
}

export const DisputeRow: React.FC<DisputeRowProps> = ({ item, onPress }) => {
  const theme = useAppTheme();
  
  const eventTitle = item.session?.event?.title || item.session?.title || `DISPUTE #${item.id.slice(0, 8).toUpperCase()}`;
  const formattedDate = new Date(item.createdAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const styles = useMemo(() => StyleSheet.create({
    container: {
      backgroundColor: theme.colors.surfaceContainerLow,
      borderColor: theme.colors.borderHairline,
      borderWidth: 1,
      padding: 14,
      marginBottom: 10,
    },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 8,
    },
    disputeId: {
      color: theme.colors.onSurfaceVariant,
      flexShrink: 1,
    },
    eventTitle: {
      marginBottom: 4,
      fontSize: 14,
    },
    reasonSnippet: {
      fontStyle: 'italic',
      color: theme.colors.onSurfaceVariant,
      marginBottom: 10,
    },
    footerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      flexWrap: 'wrap',
      gap: 8,
      borderTopWidth: 1,
      borderTopColor: theme.colors.borderHairline,
      paddingTop: 12,
      marginTop: 4,
    },
    dateText: {
      color: theme.colors.onSurfaceVariant,
      flexShrink: 1,
    },
    arrowText: {
      color: theme.colors.primary,
      flexShrink: 1,
    },
  }), [theme]);

  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.headerRow}>
        <MonoLabel style={styles.disputeId}>CLAIM ID: #{item.id.slice(0, 8).toUpperCase()}</MonoLabel>
        <DisputeStatusBadge status={item.status} />
      </View>

      <Title style={styles.eventTitle} numberOfLines={1}>
        {eventTitle}
      </Title>

      <Body style={styles.reasonSnippet} numberOfLines={2}>
        "{item.reason}"
      </Body>

      <View style={styles.footerRow}>
        <Mono style={styles.dateText}>FILED: {formattedDate}</Mono>
        <MonoLabel style={styles.arrowText}>VIEW CLAIM →</MonoLabel>
      </View>
    </TouchableOpacity>
  );
};
