import React from 'react';
import { View, Text, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useNotificationInbox, NotificationPayload } from '../../src/hooks/use-notification-inbox';
import { useNetworkStatus } from '../../src/infrastructure/network';
import { Banner, Card, Skeleton, EmptyState, Button, Badge } from '../../src/ui/primitives';

export default function NotificationsScreen() {
  const router = useRouter();
  const { isOnline } = useNetworkStatus();
  
  const {
    data,
    isLoading,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
    isRefetching,
    markAsRead,
    markAllAsRead,
    isMarkingAllRead,
  } = useNotificationInbox();

  const handleNotificationPress = (notification: NotificationPayload) => {
    if (!notification.readAt) {
      markAsRead(notification.id);
    }
    // Deep linking routing logic would go here, explicitly omitted per requirements
  };

  const renderItem = ({ item }: { item: NotificationPayload }) => (
    <TouchableOpacity 
      onPress={() => handleNotificationPress(item)}
      accessibilityRole="button"
      accessibilityLabel={`Notification: ${item.title}`}
      accessibilityState={{ selected: !item.readAt }}
      className="mb-2"
    >
      <Card>
        <View className="flex-row justify-between items-start mb-1">
          <Text className={`font-bold text-lg flex-1 ${!item.readAt ? 'text-primary' : 'text-gray-800'}`}>
            {item.title}
          </Text>
          {!item.readAt && <Badge text="New" variant="primary" />}
        </View>
        <Text className="text-gray-600 mb-2">{item.body}</Text>
        <Text className="text-xs text-gray-400">
          {new Date(item.createdAt).toLocaleString()}
        </Text>
      </Card>
    </TouchableOpacity>
  );

  const flatData = data?.pages.flatMap((page) => page.data) ?? [];

  return (
    <View className="flex-1 bg-gray-50" accessibilityRole="scrollbar">
      {!isOnline && <Banner message="You are offline. Showing cached notifications." type="warning" />}

      <View className="p-4 flex-row justify-between items-center bg-white border-b border-gray-200 shadow-sm">
        <Text className="text-xl font-bold" accessibilityRole="header">Inbox</Text>
        <Button 
          title="Mark all read" 
          variant="secondary" 
          disabled={!isOnline || flatData.length === 0} 
          loading={isMarkingAllRead}
          onPress={() => markAllAsRead()} 
          accessibilityLabel="Mark all notifications as read"
        />
      </View>

      {isLoading && flatData.length === 0 ? (
        <View className="p-4" accessibilityRole="progressbar" accessibilityLabel="Loading notifications">
          <Skeleton height={100} />
          <Skeleton height={100} />
          <Skeleton height={100} />
        </View>
      ) : isError && flatData.length === 0 ? (
        <View className="flex-1 justify-center items-center p-4">
          <Banner message="Failed to load notifications." type="error" />
          <Button title="Retry" onPress={() => refetch()} className="mt-4" />
        </View>
      ) : (
        <FlatList
          data={flatData}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16 }}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={async () => { await refetch(); }} />
          }
          onEndReached={() => {
            if (hasNextPage && !isFetchingNextPage) {
              fetchNextPage();
            }
          }}
          onEndReachedThreshold={0.5}
          ListEmptyComponent={
            <EmptyState 
              icon="📭" 
              title="No Notifications" 
              message="You're all caught up!" 
            />
          }
          ListFooterComponent={
            isFetchingNextPage ? (
              <View className="py-4" accessibilityRole="progressbar">
                <Skeleton height={80} />
              </View>
            ) : undefined
          }
        />
      )}
    </View>
  );
}
