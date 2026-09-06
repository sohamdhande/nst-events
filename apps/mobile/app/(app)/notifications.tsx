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
import { StatusBadge } from '../../src/ui/core/StatusBadge';
import { Button } from '../../src/ui/Button';
import { useNotificationInbox, NotificationPayload } from '../../src/hooks/use-notification-inbox';
import { MobileShell } from '../../src/ui/core/MobileShell';
import { Title, Body, MonoLabel, Display, Mono } from '../../src/ui/core/Typography';

export default function NotificationsScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  
  const {
    data,
    isLoading,
    isError,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
    isRefetching,
    markAsRead,
    markAllAsRead,
    isMarkingAllRead,
  } = useNotificationInbox();

  const notifications = data?.pages.flatMap((page) => page.data) || [];
  const hasUnread = notifications.some((item: NotificationPayload) => !item.readAt);

  const handleNotificationPress = (notification: NotificationPayload) => {
    if (!notification.readAt) {
      markAsRead(notification.id);
    }
  };

  const styles = useMemo(() => StyleSheet.create({
    actionBar: {
      paddingHorizontal: theme.spacing.base,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.borderHairline,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: theme.colors.surfaceContainerLow,
    },
    actionBarLeft: {
      gap: 2,
    },
    inboxTitle: {
      color: theme.colors.onSurface,
    },
    inboxSub: {
      color: theme.colors.onSurfaceVariant,
    },
    markAllBtn: {
      minHeight: 36,
      height: 36,
      paddingHorizontal: 12,
    },
    listContent: {
      paddingHorizontal: theme.spacing.base,
      paddingVertical: theme.spacing.base,
      paddingBottom: 80,
    },
    notificationCard: {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.borderHairline,
      borderWidth: 1,
      padding: 14,
      marginBottom: 10,
      gap: 8,
    },
    unreadNotificationCard: {
      borderColor: theme.colors.primary,
      borderWidth: 1.5,
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 8,
    },
    cardTitle: {
      fontSize: 14,
      flex: 1,
    },
    readCardTitle: {
      color: theme.colors.onSurfaceVariant,
    },
    cardBody: {
      fontSize: 12,
      lineHeight: 17,
    },
    cardFooter: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderTopWidth: 1,
      borderTopColor: theme.colors.borderHairline,
      paddingTop: 8,
      marginTop: 2,
    },
    timestampText: {
      fontSize: 10,
      color: theme.colors.onSurfaceVariant,
    },
    tapReadText: {
      fontSize: 9,
      color: theme.colors.primary,
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
      fontSize: 16,
    },
    errorSub: {
      textAlign: 'center',
    },
    emptyContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 48,
      gap: 12,
    },
    emptyBadge: {
    },
    emptyTitle: {
      fontSize: 16,
    },
    emptySub: {
      textAlign: 'center',
      paddingHorizontal: 24,
      lineHeight: 18,
    },
    footerLoader: {
      paddingVertical: 12,
      alignItems: 'center',
    },
  }), [theme]);

  const renderItem = ({ item }: { item: NotificationPayload }) => {
    const formattedDate = new Date(item.createdAt).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const isUnread = !item.readAt;

    return (
      <TouchableOpacity
        style={[styles.notificationCard, isUnread && styles.unreadNotificationCard]}
        onPress={() => handleNotificationPress(item)}
        activeOpacity={0.8}
      >
        <View style={styles.cardHeader}>
          <Title style={[styles.cardTitle, !isUnread && styles.readCardTitle]} numberOfLines={1}>
            {item.title}
          </Title>
          {isUnread ? (
            <StatusBadge status="[NEW]" type="warning" />
          ) : (
            <StatusBadge status="[READ]" type="default" />
          )}
        </View>

        <Body style={styles.cardBody}>{item.body}</Body>

        <View style={styles.cardFooter}>
          <Mono style={styles.timestampText}>{formattedDate}</Mono>
          {isUnread && <MonoLabel style={styles.tapReadText}>TAP TO MARK READ</MonoLabel>}
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <StatusBadge status="[INBOX CLEAR]" type="default" />
      <Display style={styles.emptyTitle}>NO NOTIFICATIONS</Display>
      <Body style={styles.emptySub}>
        You have no unread notifications or system alerts at this time. Check-in reminders and dispute updates will arrive here.
      </Body>
    </View>
  );

  return (
    <MobileShell title="NOTIFICATIONS" showBackButton scrollable={false}>
      {/* Control Action Bar */}
      <View style={styles.actionBar}>
        <View style={styles.actionBarLeft}>
          <MonoLabel style={styles.inboxTitle}>SYSTEM INBOX</MonoLabel>
          <Mono style={styles.inboxSub}>{notifications.length} MESSAGES</Mono>
        </View>

        <Button
          title={isMarkingAllRead ? 'MARKING...' : 'MARK ALL READ'}
          variant="secondary"
          disabled={!hasUnread || isMarkingAllRead}
          loading={isMarkingAllRead}
          onPress={() => markAllAsRead()}
          style={styles.markAllBtn}
        />
      </View>

      {isLoading && notifications.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <MonoLabel>FETCHING INBOX MESSAGES...</MonoLabel>
        </View>
      ) : isError && notifications.length === 0 ? (
        <View style={styles.errorContainer}>
          <StatusBadge status="[FETCH ERROR]" type="error" />
          <Display style={styles.errorTitle}>FAILED TO LOAD</Display>
          <Body style={styles.errorSub}>{(error as any)?.message || 'Unable to fetch notifications.'}</Body>
          <Button title="RETRY FETCH" variant="secondary" onPress={() => refetch()} />
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
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
