import React from 'react';
import { View, Text, FlatList, ActivityIndicator, TouchableOpacity, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useEvents, EventResponse } from '../../src/hooks/use-events';
import { Card, Skeleton, EmptyState, Badge } from '../../src/ui/primitives';

export default function AppHomeScreen() {
  const router = useRouter();
  const { data, isLoading, isError, hasNextPage, fetchNextPage, isFetchingNextPage, refetch, isRefetching } = useEvents();

  const events = data?.pages.flatMap((page) => page.data) || [];

  const renderItem = ({ item }: { item: EventResponse }) => {
    return (
      <TouchableOpacity onPress={() => router.push(`/events/${item.id}`)} accessibilityRole="button">
        <Card>
          <View className="flex-row justify-between items-start mb-2">
            <Text className="text-lg font-bold flex-1" numberOfLines={2}>{item.title}</Text>
            {item.registrationType === 'TEAM' && <Badge text="TEAM" variant="secondary" />}
          </View>
          
          <Text className="text-gray-600 mb-1">
            {new Date(item.startTime).toLocaleDateString()} at {new Date(item.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
          
          <Text className="text-gray-500 mb-3" numberOfLines={1}>{item.locationName}</Text>
          
          <View className="flex-row items-center gap-2 flex-wrap">
            <Badge text={item.eventType.replace('_', ' ')} variant="primary" />
            
            {item.audience === 'ALL_STUDENTS' ? (
              <Badge text="Open to all students" variant="secondary" />
            ) : item.audience === 'SPECIFIC_BATCHES' ? (
              <Badge text="Targeted to selected batches" variant="secondary" />
            ) : null}
            
            {item.state === 'PUBLISHED' ? null : (
              <Badge text={item.state} variant="secondary" />
            )}
          </View>
        </Card>
      </TouchableOpacity>
    );
  };

  const renderFooter = () => {
    if (!isFetchingNextPage) return null;
    return (
      <View className="p-4 items-center">
        <ActivityIndicator size="small" />
      </View>
    );
  };

  const renderEmpty = () => {
    if (isLoading) return null;
    if (isError) return <EmptyState title="Error" message="Failed to load events." icon="⚠️" />;
    return <EmptyState title="No events" message="No events available." icon="📅" />;
  };

  return (
    <View className="flex-1 bg-gray-50">
      <View className="p-4 bg-white border-b border-gray-200 pt-12">
        <Text className="text-2xl font-bold">Discover Events</Text>
      </View>
      
      {isLoading && !isRefetching ? (
        <View className="p-4">
          <Skeleton height={150} />
          <Skeleton height={150} />
          <Skeleton height={150} />
        </View>
      ) : (
        <FlatList
          data={events}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16 }}
          ListEmptyComponent={renderEmpty}
          ListFooterComponent={renderFooter}
          onEndReached={() => {
            if (hasNextPage) fetchNextPage();
          }}
          onEndReachedThreshold={0.5}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={async () => { await refetch(); }} />
          }
        />
      )}
    </View>
  );
}
