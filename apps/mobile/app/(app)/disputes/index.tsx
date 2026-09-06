import React, { useMemo } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAppTheme } from '../../../src/store/theme-store';
import { StatusBadge } from '../../../src/ui/core/StatusBadge';
import { Button } from '../../../src/ui/Button';
import { DisputeRow } from '../../../src/ui/DisputeRow';
import { useMyDisputes, AttendanceDisputeItem } from '../../../src/hooks/use-disputes';
import { MobileShell } from '../../../src/ui/core/MobileShell';
import { Title, Body, MonoLabel, Mono, Display } from '../../../src/ui/core/Typography';

export default function MyDisputesScreen() {
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
  } = useMyDisputes();

  const disputes = data?.pages.flatMap((page) => page.data) || [];

  const handleDisputePress = (item: AttendanceDisputeItem) => {
    router.push({
      pathname: '/disputes/[id]',
      params: {
        id: item.id,
        sessionId: item.sessionId,
        eventId: item.eventId,
        reason: item.reason,
        status: item.status,
        submittedAt: item.submittedAt || item.createdAt,
        reviewedAt: item.reviewedAt || '',
        reviewNotes: item.reviewNotes || '',
        eventTitle: item.session?.event?.title || item.session?.title || '',
      },
    });
  };

  const styles = useMemo(() => StyleSheet.create({
    listContent: {
      paddingHorizontal: theme.spacing.base,
      paddingBottom: 80,
    },
    listHeader: {
      paddingVertical: 12,
    },
    statusSummaryBar: {
      backgroundColor: theme.colors.surfaceContainerLow,
      borderColor: theme.colors.borderHairline,
      borderWidth: 1,
      padding: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-around',
      marginBottom: 16,
    },
    statusItem: {
      alignItems: 'center',
    },
    statusCount: {
      fontSize: 16,
      color: theme.colors.onSurface,
    },
    statusLabel: {
      fontSize: 9,
      color: theme.colors.onSurfaceVariant,
      letterSpacing: 0.5,
      marginTop: 2,
    },
    statusDivider: {
      width: 1,
      height: 24,
      backgroundColor: theme.colors.borderHairline,
    },
    sectionHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 10,
    },
    sectionHeaderTitle: {
      color: theme.colors.onSurfaceVariant,
      letterSpacing: 1,
    },
    sectionHeaderCount: {
      color: theme.colors.onSurfaceVariant,
    },
    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      paddingHorizontal: 24,
    },
    errorContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      gap: 12,
    },
    errorTitle: {
      fontSize: 16,
      textAlign: 'center',
    },
    errorSub: {
      textAlign: 'center',
    },
    emptyContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 48,
      paddingHorizontal: 24,
      gap: 12,
    },
    emptyBadge: {
    },
    emptyTitle: {
      fontSize: 16,
      textAlign: 'center',
    },
    emptySub: {
      textAlign: 'center',
      lineHeight: 18,
    },
    emptyCta: {
      marginTop: 8,
    },
    footerLoader: {
      paddingVertical: 12,
      alignItems: 'center',
    },
  }), [theme]);

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <StatusBadge status="[NO CLAIMS FILED]" type="default" />
      <Display style={styles.emptyTitle}>NO DISPUTES RECORDED</Display>
      <Body style={styles.emptySub}>
        You have not submitted any attendance dispute claims. If an attendance check-in fails, you can file a claim from Attendance History.
      </Body>
      <Button
        title="GO TO ATTENDANCE HISTORY"
        variant="secondary"
        onPress={() => router.push('/history')}
        style={styles.emptyCta}
      />
    </View>
  );

  const renderHeader = () => (
    <View style={styles.listHeader}>
      <View style={styles.statusSummaryBar}>
        <View style={styles.statusItem}>
          <Mono style={styles.statusCount}>
            {disputes.filter((d) => d.status === 'PENDING').length}
          </Mono>
          <MonoLabel style={styles.statusLabel}>PENDING</MonoLabel>
        </View>
        <View style={styles.statusDivider} />
        <View style={styles.statusItem}>
          <Mono style={styles.statusCount}>
            {disputes.filter((d) => d.status === 'APPROVED').length}
          </Mono>
          <MonoLabel style={styles.statusLabel}>APPROVED</MonoLabel>
        </View>
        <View style={styles.statusDivider} />
        <View style={styles.statusItem}>
          <Mono style={styles.statusCount}>
            {disputes.filter((d) => d.status === 'REJECTED').length}
          </Mono>
          <MonoLabel style={styles.statusLabel}>REJECTED</MonoLabel>
        </View>
      </View>

      <View style={styles.sectionHeaderRow}>
        <MonoLabel style={styles.sectionHeaderTitle}>SUBMITTED CLAIMS</MonoLabel>
        <MonoLabel style={styles.sectionHeaderCount}>{disputes.length} TOTAL</MonoLabel>
      </View>
    </View>
  );

  return (
    <MobileShell title="MY DISPUTES" showBackButton scrollable={false}>
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <MonoLabel>FETCHING DISPUTE CLAIMS...</MonoLabel>
        </View>
      ) : isError ? (
        <View style={styles.errorContainer}>
          <StatusBadge status="[FETCH ERROR]" type="error" />
          <Display style={styles.errorTitle}>FAILED TO LOAD DISPUTES</Display>
          <Body style={styles.errorSub}>{error?.message || 'Unable to connect to dispute service.'}</Body>
          <Button title="RETRY FETCH" variant="secondary" onPress={() => refetch()} />
        </View>
      ) : (
        <FlatList
          data={disputes}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <DisputeRow item={item} onPress={() => handleDisputePress(item)} />
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
      )}
    </MobileShell>
  );
}
