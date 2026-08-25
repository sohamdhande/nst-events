import React from 'react';
import { View, Text, ScrollView, RefreshControl } from 'react-native';
import { usePendingInvitations } from '../../src/hooks/use-invitations';
import { useTeams } from '../../src/hooks/use-teams';
import { Card, Button, EmptyState, Banner } from '../../src/ui/primitives';
import { useNetworkStatus } from '../../src/infrastructure/network';
import { useLocalSearchParams, useRouter } from 'expo-router';

export default function InvitationsScreen() {
  const { invitationId } = useLocalSearchParams<{ invitationId: string }>();
  const { data: invitations, isLoading, refetch, isRefetching } = usePendingInvitations();
  const { isOnline } = useNetworkStatus();
  const router = useRouter();

  // We instantiate useTeams without an eventId here, just to get the mutation hooks.
  // The mutations accept teamId and invitationId directly.
  const { acceptInvitation, isAccepting, declineInvitation, isDeclining } = useTeams('');

  const isActionLoading = isAccepting || isDeclining;

  return (
    <ScrollView 
      className="flex-1 bg-gray-50 p-4" 
      accessibilityRole="scrollbar"
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
    >
      {!isOnline && <Banner message="You are currently offline." type="error" accessibilityRole="alert" />}

      <Text className="text-2xl font-bold mb-4" accessibilityRole="header">Team Invitations</Text>

      {isLoading && !isRefetching ? (
        <View accessibilityRole="progressbar">
          <Text className="text-gray-500 text-center py-4">Loading invitations...</Text>
        </View>
      ) : (
        <View>
          {(!invitations || invitations.length === 0) ? (
            <EmptyState icon="✉️" title="No Pending Invitations" message="You have no pending team invitations right now." />
          ) : (
            invitations.map((inv) => {
              if (invitationId && inv.invitation_id !== invitationId) return null;
              const isExpired = new Date(inv.expires_at) < new Date();

              return (
                <Card key={inv.invitation_id}>
                  <View className={`mb-4 ${invitationId === inv.invitation_id ? 'bg-blue-50 p-2 rounded' : ''}`}>
                    <Text className="text-lg font-bold">{inv.team.team_name}</Text>
                    <Text className="text-gray-600">Event: {inv.event.event_title}</Text>
                    <Text className="text-gray-500">Invited by: {inv.inviter.full_name}</Text>
                    <Text className="text-xs text-gray-400 mt-1">
                      Expires: {new Date(inv.expires_at).toLocaleDateString()} {new Date(inv.expires_at).toLocaleTimeString()}
                    </Text>
                  </View>

                  {isExpired ? (
                    <Banner message="Invitation expired." type="warning" />
                  ) : (
                    <View className="flex-row justify-end space-x-2">
                      <Button 
                        title="Decline" 
                        variant="danger" 
                        accessibilityLabel={`Decline invitation to ${inv.team.team_name}`}
                        disabled={!isOnline || isActionLoading}
                        onPress={() => declineInvitation({ teamId: inv.team.team_id, invitationId: inv.invitation_id })} 
                      />
                      <View className="w-2" />
                      <Button 
                        title="Accept" 
                        variant="primary" 
                        accessibilityLabel={`Accept invitation to ${inv.team.team_name}`}
                        disabled={!isOnline || isActionLoading}
                        onPress={() => acceptInvitation({ teamId: inv.team.team_id, invitationId: inv.invitation_id }, {
                          onSuccess: () => {
                            router.push(`/events/${inv.event.event_id}/teams`);
                          }
                        })} 
                      />
                    </View>
                  )}
                </Card>
              );
            })
          )}
        </View>
      )}
    </ScrollView>
  );
}
