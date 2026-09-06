import React, { useState, useMemo } from 'react';
import { View, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppTheme } from '../../src/store/theme-store';
import { useUserProfile } from '../../src/hooks/use-user-profile';
import { useEvents, useEventSessions, EventResponse } from '../../src/hooks/use-events';
import { useMyRegistrations, MyRegistrationItem } from '../../src/hooks/use-registration';
import { MobileShell } from '../../src/ui/core/MobileShell';
import { EventCard, ActiveAttendanceCard } from '../../src/ui/core/Cards';
import { MonoLabel, Display, Body } from '../../src/ui/core/Typography';
import { useAttendanceHistory } from '../../src/hooks/use-attendance-history';

function EventRow({ 
  event, 
  userRegistrations, 
  userClubMemberships,
  mode = 'all',
  onLiveStatus
}: { 
  event: EventResponse; 
  userRegistrations: MyRegistrationItem[];
  userClubMemberships: Array<{ club_id: string; role: string }>;
  mode?: 'all' | 'live_only' | 'upcoming_only';
  onLiveStatus?: (eventId: string, isLive: boolean) => void;
}) {
  const router = useRouter();
  const theme = useAppTheme();
  const { data: sessions, isLoading: sessionsLoading } = useEventSessions(event.id);
  const { data: attendanceHistory, isLoading: historyLoading } = useAttendanceHistory(event.id);

  const primaryClubId = event.eventClubs?.find((ec) => ec.isPrimary)?.clubId;
  const isPrimaryClubAdmin = userClubMemberships.some(
    (cm) => cm.role === 'CLUB_ADMIN' && cm.club_id === primaryClubId
  );

  const userReg = userRegistrations.find((r) => r.eventId === event.id);
  const regStatus = userReg?.registrationStatus || 'NOT_REGISTERED';

  const now = new Date();
  const activeSession = sessions?.find((s) => {
    const openTime = new Date(s.openAt);
    const closeTime = new Date(s.closeAt);
    return now >= openTime && now <= closeTime;
  });

  const hasAttendanceForActiveSession = !!(activeSession && attendanceHistory?.pages.some(page => 
    page.data.some(record => record.sessionId === activeSession.id)
  ));

  const isSessionActive = !!activeSession;
  const isRegistered = regStatus === 'REGISTERED';
  const isWaitlisted = regStatus === 'WAITLISTED';
  const canScan = isSessionActive && isRegistered && !isPrimaryClubAdmin;

  const dateStr = new Date(event.startTime).toLocaleDateString([], { month: 'short', day: 'numeric' });
  const timeStr = new Date(event.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const isLive = canScan || (isSessionActive && isRegistered && hasAttendanceForActiveSession);

  React.useEffect(() => {
    if (onLiveStatus && !sessionsLoading && !historyLoading) {
      onLiveStatus(event.id, isLive);
    }
  }, [event.id, isLive, onLiveStatus, sessionsLoading, historyLoading]);

  if (mode === 'live_only' && !isLive) return null;
  if (mode === 'upcoming_only' && isLive) return null;

  // Render ONGOING (ActiveAttendanceCard)
  if (isLive) {
    return (
      <ActiveAttendanceCard
        key={event.id}
        title={event.title}
        location={event.locationName || 'CAMPUS VENUE'}
        date={dateStr}
        time={timeStr}
        status={hasAttendanceForActiveSession ? 'ATTENDANCE_MARKED' : 'SCAN_QR'}
        onPressAction={() => router.push(`/events/${event.id}/scan`)}
        onPressCard={() => router.push(`/events/${event.id}`)}
      />
    );
  }

  // Render UPCOMING (EventCard)
  let statusText = 'AVAILABLE';
  let statusColor = theme.colors.primary;

  if (isPrimaryClubAdmin) {
    statusText = 'ORGANIZER';
    statusColor = theme.colors.secondary;
  } else if (isRegistered) {
    statusText = 'REGISTERED';
    statusColor = theme.colors.primaryFixed;
  } else if (isWaitlisted) {
    statusText = 'WAITLISTED';
    statusColor = '#d4a200'; // Warning
  }

  return (
    <EventCard
      key={event.id}
      title={event.title}
      location={event.locationName || 'CAMPUS VENUE'}
      date={dateStr}
      time={timeStr}
      statusText={statusText}
      statusColor={statusColor}
      onPress={() => router.push(`/events/${event.id}`)}
    />
  );
}

export default function HomeAttendanceScreen() {
  const theme = useAppTheme();
  const [refreshing, setRefreshing] = useState(false);
  const [liveEventIds, setLiveEventIds] = useState<Set<string>>(new Set());

  const handleLiveStatus = React.useCallback((eventId: string, isLive: boolean) => {
    setLiveEventIds(prev => {
      if (isLive && !prev.has(eventId)) {
        const next = new Set(prev);
        next.add(eventId);
        return next;
      }
      if (!isLive && prev.has(eventId)) {
        const next = new Set(prev);
        next.delete(eventId);
        return next;
      }
      return prev;
    });
  }, []);

  const { data: profile, refetch: refetchProfile } = useUserProfile();
  const { data: eventsData, isLoading: eventsLoading, refetch: refetchEvents } = useEvents();
  const { data: registrations = [], refetch: refetchRegs } = useMyRegistrations();

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchProfile(), refetchEvents(), refetchRegs()]);
    setRefreshing(false);
  };

  const now = new Date();
  const allEvents = eventsData?.pages.flatMap((page) => page.data) || [];
  const publishedEvents = allEvents.filter((e) => {
    if (e.state !== 'PUBLISHED') return false;
    const endTime = new Date(e.endTime);
    return endTime >= now;
  });
  const userClubMemberships = profile?.club_memberships || [];

  const styles = useMemo(() => StyleSheet.create({
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.borderHairline,
      paddingBottom: 8,
      marginBottom: theme.spacing.md,
    },
    sectionTitle: {
      color: theme.colors.onSurfaceVariant,
    },
    sectionSub: {
      color: theme.colors.outline,
    },
    loadingContainer: {
      padding: theme.spacing.xl,
      alignItems: 'center',
    },
    emptyContainer: {
      backgroundColor: theme.colors.surfaceContainerLow,
      padding: theme.spacing.xl,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.colors.outlineVariant,
    },
    emptyTitle: {
      color: theme.colors.primary,
      marginBottom: 8,
      fontSize: 20,
    },
    emptySub: {
      textAlign: 'center',
    },
    eventsList: {
      // List is handled by MobileShell's spacing, but we can add minor flex behavior if needed
    },
    footerContainer: {
      marginTop: theme.spacing.xl,
      paddingTop: theme.spacing.xl,
      borderTopWidth: 1,
      borderTopColor: theme.colors.borderHairline,
      alignItems: 'center',
      paddingBottom: 32,
    },
    footerTitle: {
      color: theme.colors.onSurfaceVariant,
      marginBottom: 4,
    },
    footerSub: {
      color: theme.colors.outline,
      textAlign: 'center',
    },
  }), [theme]);

  return (
    <MobileShell 
      title="ATTENDANCE" 
      scrollable={true}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.colors.primary} />
      }
    >
      {eventsLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : publishedEvents.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Display style={styles.emptyTitle}>NO SESSIONS</Display>
          <Body style={styles.emptySub}>Check back later when an event session begins.</Body>
        </View>
      ) : (
        <View style={styles.eventsList}>
          {liveEventIds.size > 0 && (
            <View style={styles.sectionHeader}>
              <MonoLabel style={styles.sectionTitle}>LIVE NOW / ONGOING ATTENDANCE</MonoLabel>
            </View>
          )}
          {publishedEvents.map((event) => (
            <EventRow
              key={`live-${event.id}`}
              event={event}
              userRegistrations={registrations}
              userClubMemberships={userClubMemberships}
              mode="live_only"
              onLiveStatus={handleLiveStatus}
            />
          ))}

          <View style={styles.sectionHeader}>
            <MonoLabel style={styles.sectionTitle}>UPCOMING EVENTS</MonoLabel>
            <MonoLabel style={styles.sectionSub}>{publishedEvents.length - liveEventIds.size} AVAILABLE</MonoLabel>
          </View>
          {publishedEvents.map((event) => (
            <EventRow
              key={`upcoming-${event.id}`}
              event={event}
              userRegistrations={registrations}
              userClubMemberships={userClubMemberships}
              mode="upcoming_only"
            />
          ))}

          <View style={styles.footerContainer}>
            <MonoLabel style={styles.footerTitle}>PAST EVENTS</MonoLabel>
            <Body style={styles.footerSub}>View past events on the web app.</Body>
          </View>
        </View>
      )}
    </MobileShell>
  );
}
