import React, { useMemo } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../../../src/infrastructure/api';
import { useRegistration } from '../../../../src/hooks/use-registration';
import { useEventLive } from '../../../../src/hooks/use-event-live';
import { useEventSessions } from '../../../../src/hooks/use-events';
import { useAttendanceHistory } from '../../../../src/hooks/use-attendance-history';
import { useUserProfile } from '../../../../src/hooks/use-user-profile';
import { useNetworkStatus } from '../../../../src/infrastructure/network';
import { useAppTheme } from '../../../../src/store/theme-store';
import { Button } from '../../../../src/ui/Button';
import { MobileShell } from '../../../../src/ui/core/MobileShell';
import { Title, Body, MonoLabel, Mono } from '../../../../src/ui/core/Typography';
import { StatusBadge } from '../../../../src/ui/core/StatusBadge';

export default function EventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { isOnline } = useNetworkStatus();
  const theme = useAppTheme();

  useEventLive(id as string);

  const { data: profile } = useUserProfile();

  const { data: event, isLoading: isEventLoading } = useQuery({
    queryKey: ['events', id],
    queryFn: () => apiClient(`/v1/events/${id}`),
  });

  const { data: registration, isLoading: isRegLoading } = useQuery({
    queryKey: ['events', id, 'registration'],
    queryFn: () => apiClient(`/v1/events/${id}/my-registration`),
  });

  const { data: sessions = [] } = useEventSessions(id as string);
  const { data: attendanceHistory } = useAttendanceHistory(id as string);

  const { register, cancel, isRegistering, isCancelling } = useRegistration(id as string);

  const isLoading = isEventLoading || isRegLoading;
  const isActionLoading = isRegistering || isCancelling;
  
  const isFull = event?.maxCapacity ? (event.registrationCount || 0) >= event.maxCapacity : false;
  
  const primaryClub = event?.eventClubs?.find((ec: any) => ec.isPrimary);
  const isPrimaryClubAdmin = !!(profile?.club_memberships?.some(
    (m: any) => m.club_id === primaryClub?.clubId && m.role === 'CLUB_ADMIN'
  ));

  const now = new Date();
  const activeSession = sessions.find((s: any) => {
    const openAt = new Date(s.openAt);
    const closeAt = s.closeAt ? new Date(s.closeAt) : null;
    return openAt <= now && (!closeAt || closeAt >= now);
  });

  const hasAttendanceForActiveSession = !!(activeSession && attendanceHistory?.pages.some((page: any) => 
    page.data.some((record: any) => record.sessionId === activeSession.id)
  ));

  const isEventEnded = event?.endTime ? new Date(event.endTime) < now : false;

  const styles = useMemo(() => StyleSheet.create({
    heroSection: {
      paddingBottom: theme.spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.borderHairline,
    },
    statusRow: {
      marginBottom: theme.spacing.sm,
    },
    title: {
      fontSize: 28,
      lineHeight: 32,
      marginBottom: 8,
    },
    location: {
      color: theme.colors.onSurfaceVariant,
      letterSpacing: 1,
    },
    gridSection: {
      backgroundColor: theme.colors.surfaceContainerLow,
      borderWidth: 1,
      borderColor: theme.colors.outlineVariant,
    },
    gridRow: {
      flexDirection: 'row',
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.outlineVariant,
    },
    gridRowLast: {
      flexDirection: 'row',
    },
    gridCol: {
      flex: 1,
      padding: theme.spacing.base,
    },
    gridColRight: {
      borderLeftWidth: 1,
      borderLeftColor: theme.colors.outlineVariant,
    },
    metaLabel: {
      marginBottom: 4,
    },
    successColor: {
      color: theme.colors.primaryFixed,
    },
    infoBlock: {
      gap: 6,
    },
    descriptionBlock: {
      gap: 8,
    },
    actionSection: {
      marginTop: theme.spacing.lg,
    },
    actionBtn: {
      flex: 1,
    },
    cancelBtn: {
      marginRight: theme.spacing.sm,
    },
    multiActionTray: {
      flexDirection: 'row',
    },
    restrictedTray: {
      backgroundColor: theme.colors.surfaceContainerHighest,
      padding: theme.spacing.base,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.colors.outlineVariant,
    },
    restrictedText: {
      color: theme.colors.onSurfaceVariant,
      textAlign: 'center',
    },
    successTray: {
      backgroundColor: theme.colors.surfaceContainerHighest,
      padding: theme.spacing.base,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.colors.primaryFixed,
    },
    successText: {
      color: theme.colors.primaryFixed,
    },
    loadingContainer: {
      paddingTop: 80,
      alignItems: 'center',
      gap: 16,
    },
  }), [theme]);
  
  const renderActionTray = () => {
    if (!isOnline) {
      return (
        <View style={styles.restrictedTray}>
          <MonoLabel style={styles.restrictedText}>OFFLINE — ACTIONS UNAVAILABLE</MonoLabel>
        </View>
      );
    }

    if (isPrimaryClubAdmin) {
      return (
        <View style={styles.restrictedTray}>
          <MonoLabel style={styles.restrictedText}>ORGANIZER — USE DESKTOP TO MANAGE</MonoLabel>
        </View>
      );
    }
    
    // Check locked state BEFORE session/registration logic to satisfy audit rule
    if (event?.isLocked || isEventEnded || event?.state !== 'PUBLISHED') {
      return (
        <View style={styles.restrictedTray}>
          <MonoLabel style={styles.restrictedText}>
            {event?.isLocked ? 'EVENT LOCKED' : isEventEnded ? 'EVENT ENDED' : 'REGISTRATION CLOSED'}
          </MonoLabel>
        </View>
      );
    }

    const status = registration?.status || 'NOT_REGISTERED';

    if (status === 'REGISTERED') {
      if (activeSession) {
        if (hasAttendanceForActiveSession) {
          return (
            <View style={styles.successTray}>
              <MonoLabel style={styles.successText}>ATTENDANCE MARKED</MonoLabel>
            </View>
          );
        }
        return (
          <Button
            title="[ SCAN QR ]"
            onPress={() => router.push(`/events/${id}/scan`)}
            variant="primary"
            style={styles.actionBtn}
          />
        );
      }
      
      return (
        <View style={styles.restrictedTray}>
          <MonoLabel style={styles.restrictedText}>REGISTERED — WAITING FOR SESSION</MonoLabel>
        </View>
      );
    }

    return (
      <View style={styles.restrictedTray}>
        <MonoLabel style={styles.restrictedText}>
          STATUS: {status.replace('_', ' ')}
        </MonoLabel>
      </View>
    );
  };

  const getStatusDisplay = () => {
    if (isEventEnded) return 'ENDED';
    if (activeSession) return 'LIVE NOW';
    return event?.state || 'UNKNOWN';
  };

  return (
    <MobileShell title="EVENT" showBackButton>
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <MonoLabel>LOADING EVENT DETAILS...</MonoLabel>
        </View>
      ) : (
        <>
          <View style={styles.heroSection}>
            <View style={styles.statusRow}>
              <StatusBadge 
                status={getStatusDisplay()} 
                type={activeSession ? 'error' : isEventEnded ? 'default' : 'info'} 
              />
            </View>
            <Title style={styles.title}>{event?.title?.toUpperCase() || 'UNTITLED EVENT'}</Title>
            <Body style={styles.location}>{event?.locationName?.toUpperCase() || 'CAMPUS VENUE'}</Body>
          </View>

          <View style={styles.gridSection}>
            <View style={styles.gridRow}>
              <View style={styles.gridCol}>
                <MonoLabel style={styles.metaLabel}>DATE</MonoLabel>
                <Mono>
                  {event?.startTime ? new Date(event.startTime).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : 'TBA'}
                </Mono>
              </View>
              <View style={[styles.gridCol, styles.gridColRight]}>
                <MonoLabel style={styles.metaLabel}>TIME</MonoLabel>
                <Mono>
                  {event?.startTime ? new Date(event.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'TBA'}
                </Mono>
              </View>
            </View>
            <View style={styles.gridRowLast}>
              <View style={styles.gridCol}>
                <MonoLabel style={styles.metaLabel}>REGISTRATION</MonoLabel>
                <Mono style={registration?.status === 'REGISTERED' ? styles.successColor : {}}>
                  {registration?.status || 'NOT_REGISTERED'}
                </Mono>
              </View>
              <View style={[styles.gridCol, styles.gridColRight]}>
                <MonoLabel style={styles.metaLabel}>CAPACITY</MonoLabel>
                <Mono>
                  {event?.registrationCount || 0} / {event?.maxCapacity || '∞'}
                </Mono>
              </View>
            </View>
          </View>

          {event?.registrationType === 'TEAM' && (
            <View style={styles.infoBlock}>
              <MonoLabel style={styles.metaLabel}>TEAM REQUIREMENTS</MonoLabel>
              <Body>
                {event?.metadata?.minimum_team_size ? `Min: ${event.metadata.minimum_team_size} members` : 'No minimum'}
                {event?.metadata?.maximum_team_size ? `  •  Max: ${event.metadata.maximum_team_size} members` : ''}
              </Body>
            </View>
          )}

          <View style={styles.descriptionBlock}>
            <MonoLabel style={styles.metaLabel}>ABOUT EVENT</MonoLabel>
            <Body>
              {event?.description || 'No additional details provided.'}
            </Body>
          </View>

          <View style={styles.actionSection}>
            {renderActionTray()}
          </View>
        </>
      )}
    </MobileShell>
  );
}
