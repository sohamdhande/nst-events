import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../../../src/infrastructure/api';
import { useRegistration } from '../../../../src/hooks/use-registration';
import { useEventLive } from '../../../../src/hooks/use-event-live';
import { useNetworkStatus } from '../../../../src/infrastructure/network';
import { Button, Banner, Skeleton, Card, Divider, Badge } from '../../../../src/ui/primitives';

export default function EventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { isOnline } = useNetworkStatus();

  // Realtime synchronization hook automatically patches cache
  useEventLive(id as string);

  // Queries (Single source of truth)
  const { data: event, isLoading: isEventLoading } = useQuery({
    queryKey: ['events', id],
    queryFn: () => apiClient(`/v1/events/${id}`),
  });

  const { data: registration, isLoading: isRegLoading } = useQuery({
    queryKey: ['events', id, 'registration'],
    queryFn: () => apiClient(`/v1/events/${id}/my-registration`),
  });

  // Mutations
  const { register, cancel, isRegistering, isCancelling, error } = useRegistration(id as string);

  const isLoading = isEventLoading || isRegLoading;
  const isActionLoading = isRegistering || isCancelling;
  const isFull = event?.max_capacity ? event.registration_count >= event.max_capacity : false;

  const registrationError = (error as any)?.status === 403 && (error as any)?.message?.includes('AUDIENCE_NOT_ELIGIBLE');

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
            <Text className="text-2xl font-bold mb-2" accessibilityRole="header">{event?.title || 'Event Details'}</Text>
            <Text className="text-gray-600 mb-4">{event?.description || 'No description available.'}</Text>

            <View className="flex-row justify-between mb-2">
              <Text className="font-bold">Capacity:</Text>
              <Text accessibilityLabel={`${event?.registration_count || 0} out of ${event?.max_capacity || 'unlimited'} registered`}>
                {event?.registration_count || 0} / {event?.max_capacity || '∞'}
              </Text>
            </View>

            <Divider />

            <View className="mb-4">
              <Text className="font-bold">Audience:</Text>
              {event?.audience === 'ALL_STUDENTS' ? (
                <Text>Open to all students</Text>
              ) : event?.audience === 'SPECIFIC_BATCHES' ? (
                <Text>Targeted to selected batches</Text>
              ) : (
                <Text>{event?.audience}</Text>
              )}
            </View>

            <Divider />

            {event?.registration_type === 'TEAM' && (event?.metadata?.minimum_team_size || event?.metadata?.maximum_team_size) && (
              <View className="mb-4">
                <Text className="font-bold mb-1">Team Registration</Text>
                <Text className="text-gray-600">
                  {event.metadata.minimum_team_size && `Minimum: ${event.metadata.minimum_team_size}`}
                  {event.metadata.minimum_team_size && event.metadata.maximum_team_size && ' • '}
                  {event.metadata.maximum_team_size && `Maximum: ${event.metadata.maximum_team_size}`}
                </Text>
              </View>
            )}

            {event?.is_locked && (
              <Banner message="Event is locked" type="warning" accessibilityRole="alert" />
            )}

            {registrationError && (
              <Banner message="This event is not available to your academic batch." type="error" accessibilityRole="alert" />
            )}

            {registration?.status === 'REGISTERED' || registration?.status === 'WAITLISTED' || registration?.status === 'FORMING' || registration?.status === 'CANCELLED' ? (
              <View>
                {registration.status === 'WAITLISTED' && (
                  <Text className="text-lg mb-2 text-center font-bold text-yellow-600">
                    Your team is waiting for event capacity.
                    {registration.waitlist_position && ` (Position: ${registration.waitlist_position})`}
                  </Text>
                )}
                {registration.status === 'REGISTERED' && event?.registration_type === 'TEAM' && (
                  <Text className="text-lg mb-2 text-center font-bold text-green-600">
                    Team registered
                  </Text>
                )}
                {registration.status === 'FORMING' && (
                  <Text className="text-lg mb-2 text-center font-bold text-blue-600">
                    Your team is still forming.
                  </Text>
                )}
                {registration.status === 'CANCELLED' && (
                  <Text className="text-lg mb-2 text-center font-bold text-red-600">
                    {event?.registration_type === 'TEAM' ? 'Team registration is cancelled.' : 'Registration is cancelled.'}
                  </Text>
                )}
                
                {registration.status !== 'CANCELLED' && (
                  <Text className="text-lg mb-4 text-center font-bold" accessibilityRole="text">
                    Status: {registration.status}
                  </Text>
                )}

                {registration.status !== 'CANCELLED' && !event?.is_locked && (
                  <Button
                    title="Cancel Registration"
                    variant="danger"
                    accessibilityLabel="Cancel Registration"
                    onPress={() => cancel()}
                    loading={isActionLoading}
                    disabled={!isOnline || isActionLoading}
                  />
                )}

                {event?.registration_type === 'TEAM' && (
                  <View className="mt-4">
                    <Button
                      title="Manage Team"
                      variant="secondary"
                      accessibilityLabel="Manage Team"
                      onPress={() => router.push(`/events/${id}/teams`)}
                      disabled={isActionLoading}
                    />
                  </View>
                )}
              </View>
            ) : (
              <View>
                {event?.registration_type === 'TEAM' ? (
                  <View>
                    {event?.state === 'CLOSED' || isFull || event?.is_locked ? (
                      <Button
                        title={event?.is_locked ? 'Event Locked' : (event?.state === 'CLOSED' ? 'Event Closed' : 'Event Full')}
                        disabled={true}
                        accessibilityLabel="Team Creation Disabled"
                      />
                    ) : (
                      <Button
                        title="Create Team"
                        variant="primary"
                        accessibilityLabel="Create Team"
                        onPress={() => router.push(`/events/${id}/team-creation`)}
                        disabled={!isOnline || event?.state !== 'PUBLISHED' || isActionLoading}
                      />
                    )}
                  </View>
                ) : (
                  <View>
                    {event?.state === 'CLOSED' || isFull || event?.is_locked ? (
                      <Button
                        title={event?.is_locked ? 'Event Locked' : (event?.state === 'CLOSED' ? 'Event Closed' : 'Event Full')}
                        disabled={true}
                        accessibilityLabel={event?.is_locked ? 'Event Locked' : (event?.state === 'CLOSED' ? 'Event Closed' : 'Event Full')}
                      />
                    ) : (
                      <Button
                        title="Register"
                        variant="primary"
                        accessibilityLabel="Register for Event"
                        onPress={() => register()}
                        loading={isActionLoading}
                        disabled={!isOnline || event?.state !== 'PUBLISHED' || isActionLoading}
                      />
                    )}
                  </View>
                )}
              </View>
            )}
          </Card>
        </View>
      )}
    </ScrollView>
  );
}
