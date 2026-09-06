import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAppTheme } from '../../../src/store/theme-store';
import { useEvent, useEventSessions } from '../../../src/hooks/use-events';
import { useAttendanceHistory } from '../../../src/hooks/use-attendance-history';
import { useMyDisputes } from '../../../src/hooks/use-disputes';

export default function AttendanceDetailScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  
  const params = useLocalSearchParams<{ id?: string }>();
  const eventId = params.id || '';

  const { data: event, isLoading: loadingEvent } = useEvent(eventId);
  const { data: sessions, isLoading: loadingSessions } = useEventSessions(eventId);
  const { data: attendanceHistory, isLoading: loadingHistory } = useAttendanceHistory(eventId);
  const { data: disputes, isLoading: loadingDisputes } = useMyDisputes(eventId);

  const isLoading = loadingEvent || loadingSessions || loadingHistory || loadingDisputes;

  const eventTitle = event?.title || 'LOADING EVENT...';
  const venue = event?.locationName || 'UNSPECIFIED VENUE';
  const eventDate = event?.startTime 
    ? new Date(event.startTime).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }).toUpperCase()
    : 'N/A';
  const eventTime = event?.startTime
    ? new Date(event.startTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).toUpperCase()
    : 'N/A';

  const allRecords = attendanceHistory?.pages.flatMap((page) => page.data) || [];
  const allDisputes = disputes?.pages.flatMap((page) => page.data) || [];

  const styles = useMemo(() => StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.colors.surface,
    },
    header: {
      height: 56,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.borderHairline,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      backgroundColor: theme.colors.surface,
    },
    backBtn: {
      paddingVertical: 6,
      paddingRight: 12,
    },
    backBtnText: {
      fontFamily: theme.typography.monoBold,
      fontSize: 11,
      color: theme.colors.primary,
    },
    headerTitle: {
      fontFamily: theme.typography.monoBold,
      fontSize: 12,
      color: theme.colors.onSurface,
      letterSpacing: 1,
    },
    container: {
      flex: 1,
      backgroundColor: theme.colors.surface,
    },
    scrollContent: {
      padding: 16,
      paddingBottom: 40,
    },
    loadingContainer: {
      marginTop: 40,
      alignItems: 'center',
    },
    eventHeader: {
      marginBottom: 32,
    },
    eventTitle: {
      fontFamily: theme.typography.syneBold,
      fontSize: 20,
      color: theme.colors.onSurface,
      textTransform: 'uppercase',
      marginBottom: 12,
    },
    eventDetailText: {
      fontFamily: theme.typography.interRegular,
      fontSize: 13,
      color: theme.colors.onSurfaceVariant,
      marginBottom: 4,
      textTransform: 'uppercase',
    },
    attendanceSection: {
      marginTop: 8,
    },
    sectionTitle: {
      fontFamily: theme.typography.monoBold,
      fontSize: 12,
      color: theme.colors.onSurface,
      letterSpacing: 1,
      marginBottom: 8,
    },
    divider: {
      height: 1,
      backgroundColor: theme.colors.borderHairline,
      marginBottom: 16,
    },
    sessionCard: {
      marginBottom: 20,
    },
    sessionTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 4,
    },
    checkIcon: {
      fontFamily: theme.typography.monoBold,
      fontSize: 14,
      color: theme.colors.primary,
      marginRight: 8,
    },
    sessionTitle: {
      fontFamily: theme.typography.interRegular,
      fontSize: 14,
      color: theme.colors.onSurface,
      textTransform: 'uppercase',
      flex: 1,
    },
    sessionDateTime: {
      fontFamily: theme.typography.monoRegular,
      fontSize: 11,
      color: theme.colors.outline,
      marginLeft: 26,
      marginBottom: 6,
    },
    statusPresent: {
      fontFamily: theme.typography.monoBold,
      fontSize: 12,
      color: theme.colors.primary,
      marginLeft: 26,
    },
    statusNotMarked: {
      fontFamily: theme.typography.monoBold,
      fontSize: 12,
      color: theme.colors.outline,
      marginLeft: 26,
      marginBottom: 6,
    },
    disputeActionBox: {
      marginLeft: 26,
      marginTop: 2,
    },
    disputeActionText: {
      fontFamily: theme.typography.monoBold,
      fontSize: 11,
      color: theme.colors.primary,
    },
  }), [theme]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle={theme.mode === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={theme.colors.surface} />
      
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>← BACK</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>ATTENDANCE</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
          </View>
        ) : (
          <>
            {/* Event Context Header */}
            <View style={styles.eventHeader}>
              <Text style={styles.eventTitle}>{eventTitle}</Text>
              <Text style={styles.eventDetailText}>{venue}</Text>
              <Text style={styles.eventDetailText}>{eventDate}</Text>
              <Text style={styles.eventDetailText}>{eventTime}</Text>
            </View>

            {/* Attendance Sessions List */}
            <View style={styles.attendanceSection}>
              <Text style={styles.sectionTitle}>ATTENDANCE</Text>
              <View style={styles.divider} />
              
              {sessions?.map((session) => {
                const record = allRecords.find((r) => r.sessionId === session.id);
                const dispute = allDisputes.find((d) => d.sessionId === session.id);
                const isPresentOrExcused = record && (record.status === 'PRESENT' || record.status === 'EXCUSED');
                const isNotMarked = !record;

                const sessionDate = new Date(session.startTime).toLocaleDateString('en-US', { month: 'short', day: '2-digit' }).toUpperCase();
                const sessionTime = new Date(session.startTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).toUpperCase();
                
                return (
                  <View key={session.id} style={styles.sessionCard}>
                    <View style={styles.sessionTopRow}>
                      <Text style={styles.checkIcon}>{isPresentOrExcused ? '[✓]' : '[ ]'}</Text>
                      <Text style={styles.sessionTitle} numberOfLines={1}>{session.title}</Text>
                    </View>
                    <Text style={styles.sessionDateTime}>{sessionDate} / {sessionTime}</Text>
                    
                    {isPresentOrExcused ? (
                      <Text style={styles.statusPresent}>{record.status}</Text>
                    ) : (
                      <>
                        <Text style={styles.statusNotMarked}>{record ? record.status : 'NOT MARKED'}</Text>
                        
                        {dispute ? (
                          <TouchableOpacity 
                            style={styles.disputeActionBox}
                            onPress={() => router.push(`/disputes/submitted?disputeId=${dispute.id}&eventTitle=${encodeURIComponent(eventTitle)}&sessionId=${session.id}`)}
                          >
                            <Text style={styles.disputeActionText}>DISPUTE {dispute.status}</Text>
                          </TouchableOpacity>
                        ) : (
                          <TouchableOpacity 
                            style={styles.disputeActionBox}
                            onPress={() => router.push({
                              pathname: '/disputes/new',
                              params: {
                                sessionId: session.id,
                                eventId: session.eventId,
                                title: eventTitle,
                              }
                            })}
                          >
                            <Text style={styles.disputeActionText}>[ FILE DISPUTE ]</Text>
                          </TouchableOpacity>
                        )}
                      </>
                    )}
                  </View>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
