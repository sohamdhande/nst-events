import React, { useMemo } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAppTheme } from '../../src/store/theme-store';
import { AttendanceHistoryRow } from '../../src/ui/AttendanceHistoryRow';
import { useAttendanceHistory, AttendanceRecordItem } from '../../src/hooks/use-attendance-history';
import { MobileShell } from '../../src/ui/core/MobileShell';
import { Display, Body, MonoLabel, Mono } from '../../src/ui/core/Typography';

export default function AttendanceHistoryScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  
  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useAttendanceHistory();

  const records = data?.pages.flatMap((page) => page.data) || [];

  const handleRecordPress = (record: AttendanceRecordItem) => {
    if (!record.session?.eventId) return;
    router.push({
      pathname: '/history/[id]',
      params: {
        id: record.session.eventId,
      },
    });
  };

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
    },
    listContent: {
      padding: theme.spacing.base,
      paddingBottom: 80, // Tab bar clearance handled manually for FlatList inside scrollable=false
      flexGrow: 1,
    },
    listHeader: {
      marginBottom: theme.spacing.md,
    },
    disputesNavCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 8,
      marginBottom: 8,
    },
    disputesNavTitle: {
      color: theme.colors.onSurfaceVariant,
    },
    disputesNavArrow: {
      color: theme.colors.onSurfaceVariant,
      fontSize: 14,
    },
    sectionHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.borderHairline,
      marginBottom: 16,
    },
    sectionHeaderTitle: {
      color: theme.colors.onSurfaceVariant,
    },
    sectionHeaderCount: {
      color: theme.colors.outline,
    },
    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
    },
    errorContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      gap: 12,
    },
    errorTitle: {
      color: theme.colors.onSurface,
      fontSize: 20,
    },
    errorSub: {
      textAlign: 'center',
    },
    retryBtn: {
      marginTop: 8,
      borderWidth: 1,
      borderColor: theme.colors.primary,
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    retryBtnText: {
      color: theme.colors.primary,
    },
    emptyContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 16,
      marginTop: 40,
    },
    emptyTitle: {
      color: theme.colors.primary,
      fontSize: 18,
    },
    emptySub: {
      textAlign: 'center',
      paddingHorizontal: 32,
    },
    footerLoader: {
      paddingVertical: 12,
      alignItems: 'center',
    },
  }), [theme]);

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Display style={styles.emptyTitle}>NO ATTENDANCE RECORDS</Display>
      <Body style={styles.emptySub}>
        Scan a QR code at an event to build your record.
      </Body>
    </View>
  );

  const recordCount = records.length;
  const recordCountText = recordCount === 1 
    ? '01 RECORD' 
    : `${recordCount < 10 ? '0' + recordCount : recordCount} RECORDS`;

  const renderHeader = () => (
    <View style={styles.listHeader}>
      <TouchableOpacity
        style={styles.disputesNavCard}
        onPress={() => router.push('/disputes')}
        activeOpacity={0.8}
      >
        <MonoLabel style={styles.disputesNavTitle}>ATTENDANCE DISPUTES</MonoLabel>
        <MonoLabel style={styles.disputesNavArrow}>→</MonoLabel>
      </TouchableOpacity>

      <View style={styles.sectionHeaderRow}>
        <MonoLabel style={styles.sectionHeaderTitle}>MY ATTENDANCE</MonoLabel>
        <MonoLabel style={styles.sectionHeaderCount}>{recordCountText}</MonoLabel>
      </View>
    </View>
  );

  return (
    <MobileShell title="HISTORY" scrollable={false}>
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <MonoLabel>FETCHING ATTENDANCE LOGS...</MonoLabel>
        </View>
      ) : isError ? (
        <View style={styles.errorContainer}>
          <Display style={styles.errorTitle}>FAILED TO LOAD</Display>
          <Body style={styles.errorSub}>{error?.message || 'Unable to connect to attendance service.'}</Body>
          <TouchableOpacity onPress={() => refetch()} style={styles.retryBtn}>
            <MonoLabel style={styles.retryBtnText}>RETRY FETCH</MonoLabel>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.container}>
          <FlatList
            data={records}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <AttendanceHistoryRow item={item} onPress={() => handleRecordPress(item)} />
            )}
            ListHeaderComponent={renderHeader}
            ListEmptyComponent={renderEmptyState}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={isRefetching}
                onRefresh={refetch}
                tintColor={theme.colors.primary}
              />
            }
            onEndReached={() => {
              if (hasNextPage && !isFetchingNextPage) {
                fetchNextPage();
              }
            }}
            onEndReachedThreshold={0.5}
            ListFooterComponent={
              isFetchingNextPage ? (
                <View style={styles.footerLoader}>
                  <ActivityIndicator size="small" color={theme.colors.primary} />
                </View>
              ) : null
            }
          />
        </View>
      )}
    </MobileShell>
  );
}
