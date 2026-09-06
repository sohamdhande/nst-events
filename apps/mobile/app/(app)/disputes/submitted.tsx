import React, { useMemo } from 'react';
import {
  View,
  StyleSheet,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAppTheme } from '../../../src/store/theme-store';
import { StatusBadge } from '../../../src/ui/core/StatusBadge';
import { Button } from '../../../src/ui/Button';
import { MobileShell } from '../../../src/ui/core/MobileShell';
import { Title, Body, MonoLabel, Mono, Display } from '../../../src/ui/core/Typography';

export default function DisputeSubmittedScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  
  const params = useLocalSearchParams<{
    disputeId?: string;
    eventTitle?: string;
    sessionId?: string;
  }>();

  const disputeId = params.disputeId || 'DISP-0000';
  const eventTitle = params.eventTitle || 'CLASSROOM SESSION';
  const sessionId = params.sessionId || '';

  const styles = useMemo(() => StyleSheet.create({
    mainContainer: {
      flex: 1,
      padding: theme.spacing.base,
      justifyContent: 'space-between',
    },
    content: {
      gap: 16,
    },
    statusSection: {
      alignItems: 'center',
      paddingTop: 16,
      gap: 10,
    },
    badge: {
    },
    title: {
      fontSize: 20,
      color: theme.colors.onSurface,
      textAlign: 'center',
      letterSpacing: 0.5,
    },
    subtitle: {
      color: theme.colors.onSurfaceVariant,
      textAlign: 'center',
      paddingHorizontal: 12,
    },
    ledgerCard: {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.borderHairline,
      borderWidth: 1,
      padding: 16,
      gap: 12,
    },
    ledgerHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.borderHairline,
      paddingBottom: 8,
    },
    ledgerHeaderTitle: {
      color: theme.colors.onSurfaceVariant,
      letterSpacing: 0.5,
    },
    ledgerHeaderId: {
      color: theme.colors.primary,
    },
    eventTitle: {
      fontSize: 16,
      color: theme.colors.onSurface,
      lineHeight: 20,
    },
    metaRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    metaLabel: {
      color: theme.colors.onSurfaceVariant,
      letterSpacing: 0.5,
    },
    metaValueMono: {
      color: theme.colors.onSurface,
    },
    infoCallout: {
      backgroundColor: theme.colors.surfaceContainerLow,
      borderColor: theme.colors.borderHairline,
      borderWidth: 1,
      padding: 14,
      gap: 6,
    },
    infoCalloutTitle: {
      color: theme.colors.onSurface,
      letterSpacing: 0.5,
    },
    infoCalloutBody: {
      color: theme.colors.onSurfaceVariant,
    },
    actionContainer: {
      paddingTop: 16,
      gap: 10,
    },
  }), [theme]);

  return (
    <MobileShell title="CLAIM SUBMITTED" scrollable={false}>
      <View style={styles.mainContainer}>
        <View style={styles.content}>
          {/* Top Status Monument */}
          <View style={styles.statusSection}>
            <StatusBadge status="[DISPUTE FILED]" type="warning" />
            <Title style={styles.title}>CLAIM QUEUED FOR REVIEW</Title>
            <Body style={styles.subtitle}>
              Your attendance dispute claim has been logged into the system registry.
            </Body>
          </View>

          {/* Claim Ledger Card */}
          <View style={styles.ledgerCard}>
            <View style={styles.ledgerHeader}>
              <MonoLabel style={styles.ledgerHeaderTitle}>REGISTRY ENTRY</MonoLabel>
              <MonoLabel style={styles.ledgerHeaderId}>CLAIM #{disputeId.slice(0, 8).toUpperCase()}</MonoLabel>
            </View>

            <Title style={styles.eventTitle}>{eventTitle}</Title>

            <View style={styles.metaRow}>
              <MonoLabel style={styles.metaLabel}>TARGET SESSION</MonoLabel>
              <Mono style={styles.metaValueMono}>{sessionId || 'UNSPECIFIED'}</Mono>
            </View>

            <View style={styles.metaRow}>
              <MonoLabel style={styles.metaLabel}>CURRENT STATUS</MonoLabel>
              <StatusBadge status="PENDING REVIEW" type="warning" />
            </View>

            <View style={styles.metaRow}>
              <MonoLabel style={styles.metaLabel}>REVIEW QUEUE</MonoLabel>
              <Mono style={styles.metaValueMono}>INSTRUCTOR / FACULTY</Mono>
            </View>
          </View>

          {/* Information Callout */}
          <View style={styles.infoCallout}>
            <MonoLabel style={styles.infoCalloutTitle}>WHAT HAPPENS NEXT?</MonoLabel>
            <Body style={styles.infoCalloutBody}>
              The course instructor or assigned faculty mentor will review your claim details. If approved, your attendance status will be updated to EXCUSED in official records.
            </Body>
          </View>
        </View>

        {/* Action CTAs */}
        <View style={styles.actionContainer}>
          <Button
            title="VIEW MY DISPUTES"
            variant="primary"
            onPress={() => router.replace('/disputes')}
          />
          <Button
            title="RETURN TO HOME"
            variant="secondary"
            onPress={() => router.replace('/')}
          />
        </View>
      </View>
    </MobileShell>
  );
}
