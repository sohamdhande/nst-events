import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../../../src/infrastructure/api';
import { useRegistration } from '../../../../src/hooks/use-registration';
import { useEventLive } from '../../../../src/hooks/use-event-live';
import { useNetworkStatus } from '../../../../src/infrastructure/network';
import { Button, Banner, Skeleton, Card, Divider } from '../../../../src/ui/primitives';

export default function EventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { isOnline } = useNetworkStatus();
  
  // Realtime synchronization hook automatically patches cache
  useEventLive(id as string);

  // Queries (Single source of truth)
  const { data: event, isLoading: isEventLoading } = useQuery({
    queryKey: ['events', id],
    queryFn: () => apiClient(`/events/${id}`),
  });

  const { data: registration, isLoading: isRegLoading } = useQuery({
    queryKey: ['events', id, 'registration'],
    queryFn: () => apiClient(`/events/${id}/register`), 
  });

  // Mutations
  const { register, cancel, isRegistering, isCancelling } = useRegistration(id as string);

  const isLoading = isEventLoading || isRegLoading;
  const isActionLoading = isRegistering || isCancelling;
  const isFull = event?.max_capacity ? event.registration_count >= event.max_capacity : false;

  return (
    <ScrollView className="flex-1 bg-gray-50" accessibilityRole="scrollbar">
      {!isOnline && <Banner message="You are currently offline." type="error" accessibilityRole="alert" />}

      {isLoading ? (
        <View className="p-4" accessibilityRole="progressbar" accessibilityLabel="Loading event details">
          <Skeleton height={200} />
          <Skeleton height={40} />
          <Skeleton height={40} />
        </View>
      ) : (
        <View className="p-4">
          <Card>
            <Text className="text-2xl font-bold mb-2" accessibilityRole="header">{event?.name || 'Event Details'}</Text>
            <Text className="text-gray-600 mb-4">{event?.description || 'No description available.'}</Text>
            
            <View className="flex-row justify-between mb-2">
              <Text className="font-bold">Capacity:</Text>
              <Text accessibilityLabel={`${event?.registration_count || 0} out of ${event?.max_capacity || 'unlimited'} registered`}>
                {event?.registration_count || 0} / {event?.max_capacity || '∞'}
              </Text>
            </View>
            
            <Divider />

            {registration?.status === 'REGISTERED' || registration?.status === 'WAITLISTED' ? (
              <View>
                <Text className="text-lg mb-4 text-center font-bold" accessibilityRole="text">
                  Status: {registration.status}
                </Text>
                <Button 
                  title="Cancel Registration" 
                  variant="danger" 
                  accessibilityLabel="Cancel Registration"
                  onPress={() => cancel()} 
                  loading={isActionLoading} 
                  disabled={!isOnline}
                />
                
                {registration.status === 'REGISTERED' && event?.registration_type === 'TEAM' && (
                  <View className="mt-4">
                    <Button 
                      title="Manage Team" 
                      variant="secondary"
                      accessibilityLabel="Manage Team"
                      onPress={() => router.push(`/events/${id}/teams`)} 
                    />
                  </View>
                )}
              </View>
            ) : (
              <View>
                {event?.state === 'CLOSED' || isFull ? (
                  <Button 
                    title={event?.state === 'CLOSED' ? 'Event Closed' : 'Event Full'} 
                    disabled={true} 
                    accessibilityLabel={event?.state === 'CLOSED' ? 'Event Closed' : 'Event Full'}
                  />
                ) : (
                  <Button 
                    title="Register" 
                    variant="primary" 
                    accessibilityLabel="Register for Event"
                    onPress={() => register()} 
                    loading={isActionLoading} 
                    disabled={!isOnline || event?.state !== 'PUBLISHED'}
                  />
                )}
              </View>
            )}
          </Card>
        </View>
      )}
    </ScrollView>
  );
}
