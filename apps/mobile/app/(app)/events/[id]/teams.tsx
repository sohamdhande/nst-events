import React, { useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../../../src/infrastructure/api';
import { useTeams } from '../../../../src/hooks/use-teams';
import { useSearchInvitees, useSentInvitations } from '../../../../src/hooks/use-invitations';
import { useAuthStore } from '../../../../src/store/auth';
import { Button, Card, Skeleton, Dialog, Input, Avatar, Divider, Banner, EmptyState } from '../../../../src/ui/primitives';
import { useNetworkStatus } from '../../../../src/infrastructure/network';

export default function TeamsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const currentUserId = useAuthStore(state => state.userId);
  const { isOnline } = useNetworkStatus();
  
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [teamName, setTeamName] = useState('');
  
  const [leaveDialog, setLeaveDialog] = useState<string | null>(null);
  const [removeDialog, setRemoveDialog] = useState<string | null>(null);
  const [transferDialog, setTransferDialog] = useState<string | null>(null);
  
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const { data: event, isLoading: isEventLoading } = useQuery({
    queryKey: ['events', id],
    queryFn: () => apiClient(`/v1/events/${id}`),
  });

  const { data: registration, isLoading: isRegLoading } = useQuery({
    queryKey: ['events', id, 'registration'],
    queryFn: () => apiClient(`/v1/events/${id}/my-registration`),
  });

  const { data: teams, isLoading: isTeamsLoading } = useQuery({
    queryKey: ['teams', id],
    queryFn: () => apiClient(`/v1/events/${id}/teams`),
  });

  const { data: invitees, isLoading: isInviteesLoading } = useSearchInvitees(id as string, searchQuery);

  const myTeamPreview = teams?.find((t: any) => t.members?.some((m: any) => m.user_id === currentUserId));
  const { data: sentInvitations, isLoading: isSentLoading } = useSentInvitations(id as string, myTeamPreview?.id);

  const { 
    createTeam, isCreating, 
    leaveTeam, isLeaving, 
    removeMember, isRemoving, 
    transferLeadership, isTransferring,
    inviteMember, isInviting,
    cancelInvitation, isCancelling
  } = useTeams(id as string);

  const isLoading = isEventLoading || isRegLoading || isTeamsLoading;
  
  // Find current user's team
  const myTeam = teams?.find((t: any) => t.members?.some((m: any) => m.user_id === currentUserId));
  const isLeader = myTeam?.leader_id === currentUserId;
  const isLocked = event?.is_locked || false;

  const minSize = event?.metadata?.minimum_team_size || 1;
  const maxSize = event?.metadata?.maximum_team_size || '∞';
  const belowMinimum = myTeam && myTeam.member_count < minSize;

  const canLeave = myTeam && (!isLeader || myTeam.member_count === 1);

  return (
    <ScrollView className="flex-1 bg-gray-50 p-4" accessibilityRole="scrollbar">
      {!isOnline && <Banner message="You are currently offline." type="error" accessibilityRole="alert" />}
      {isLocked && <Banner message="This event is no longer accepting team changes." type="warning" accessibilityRole="alert" />}

      {isLoading ? (
        <View accessibilityRole="progressbar" accessibilityLabel="Loading team details">
          <Skeleton height={200} />
          <Skeleton height={150} />
        </View>
      ) : (
        <View>
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-xl font-bold" accessibilityRole="header">Team Management</Text>
            {!myTeam && (
              <Button 
                title="Create Team" 
                accessibilityLabel="Create Team"
                disabled={!isOnline || isLocked || event?.state !== 'PUBLISHED'}
                onPress={() => setCreateModalOpen(true)} 
              />
            )}
          </View>

          {myTeam ? (
            <>
              <Card>
                <View className="flex-row justify-between items-center mb-2">
                  <Text className="text-lg font-bold">{myTeam.name}</Text>
                  <Text className="text-sm font-bold bg-blue-100 text-blue-800 px-2 py-1 rounded overflow-hidden">
                    {myTeam.status || registration?.status || 'FORMING'}
                  </Text>
                </View>

                {myTeam.status === 'WAITLISTED' && (
                  <Text className="text-orange-600 mb-2 font-bold">
                    Your team is waiting for event capacity.
                    {myTeam.waitlist_position && ` (Position: #${myTeam.waitlist_position})`}
                  </Text>
                )}
                {myTeam.status === 'REGISTERED' && (
                  <Text className="text-green-600 mb-2 font-bold">Team registered</Text>
                )}
                {(myTeam.status === 'FORMING' || !myTeam.status) && (
                  <Text className="text-blue-600 mb-2 font-bold">Your team is still forming.</Text>
                )}
                {myTeam.status === 'CANCELLED' && (
                  <Text className="text-red-600 mb-2 font-bold">Team registration is cancelled.</Text>
                )}

                <Text className="text-gray-600 mb-2">
                  {myTeam.member_count} / {minSize} members (Max: {maxSize})
                </Text>

                {myTeam.status !== 'CANCELLED' && belowMinimum && (
                  <Banner message="Team below minimum size. Add an eligible member before the grace period ends." type="error" />
                )}

                <Divider />

                <Text className="font-bold mb-2">Members:</Text>
                {myTeam.members?.map((member: any) => (
                  <View key={member.user_id} className="flex-row items-center justify-between mb-2">
                    <View className="flex-row items-center">
                      <Avatar initials={member.full_name?.[0] || '?'} size={32} />
                      <Text className="ml-2" accessibilityLabel={member.full_name}>{member.full_name}</Text>
                      {myTeam.leader_id === member.user_id && (
                        <Text className="ml-2" accessibilityLabel="Team Leader">👑</Text>
                      )}
                    </View>
                    
                    {isLeader && member.user_id !== currentUserId && !isLocked && (
                      <View className="flex-row">
                        <Button 
                          title="Transfer" 
                          variant="secondary" 
                          onPress={() => setTransferDialog(member.user_id)} 
                        />
                        <View className="w-2" />
                        <Button 
                          title="Remove" 
                          variant="danger" 
                          onPress={() => setRemoveDialog(member.user_id)} 
                        />
                      </View>
                    )}
                  </View>
                ))}

                {isLeader && (
                  <View className="mt-4">
                    <Text className="font-bold mb-2">Sent Invitations:</Text>
                    {isSentLoading ? (
                      <ActivityIndicator size="small" />
                    ) : (
                      <View>
                        {sentInvitations?.length === 0 && (
                          <Text className="text-gray-500 text-sm italic">No sent invitations.</Text>
                        )}
                        {sentInvitations?.map((inv: any) => (
                          <View key={inv.invitation_id} className="flex-row items-center justify-between mb-2 p-2 bg-gray-50 rounded border border-gray-200">
                            <View>
                              <Text className="font-bold">{inv.invitee.display_name}</Text>
                              <Text className="text-xs text-gray-500">{inv.status}</Text>
                            </View>
                            {inv.status === 'PENDING' && !isLocked && (
                              <Button
                                title="Cancel"
                                size="small"
                                variant="danger"
                                disabled={isCancelling}
                                onPress={() => cancelInvitation({ teamId: myTeam.id, invitationId: inv.invitation_id })}
                              />
                            )}
                          </View>
                        ))}
                      </View>
                    )}
                    <Divider />
                  </View>
                )}

                <View className="mt-4 flex-row justify-between">
                  {isLeader && !isLocked && (
                    <Button 
                      title="Invite Member" 
                      variant="primary" 
                      accessibilityLabel="Invite Member"
                      disabled={!isOnline || (maxSize !== '∞' && myTeam.member_count >= maxSize)}
                      onPress={() => setInviteModalOpen(true)} 
                    />
                  )}
                  <View className="w-2" />
                  {!isLocked && (
                    <Button 
                      title="Leave Team" 
                      variant="danger" 
                      accessibilityLabel="Leave Team"
                      disabled={!isOnline || !canLeave}
                      onPress={() => {
                        if (!canLeave) return; // Prevent action if UI fails to disable
                        setLeaveDialog(myTeam.id)
                      }} 
                    />
                  )}
                </View>
                {!canLeave && !isLocked && (
                  <Text className="text-red-500 text-xs mt-2 text-center">Transfer leadership before leaving.</Text>
                )}
              </Card>
            </>
          ) : (
            <EmptyState icon="👥" title="You are not in a team" message="Create a team or wait for an invitation." />
          )}
        </View>
      )}

      {/* Dialogs */}
      <Dialog visible={createModalOpen} title="Create Team" onClose={() => { if(!isCreating) setCreateModalOpen(false); }}>
        <Input 
          placeholder="Team Name" 
          value={teamName} 
          onChangeText={setTeamName} 
          accessibilityLabel="Team Name Input"
        />
        <Button 
          title="Create" 
          accessibilityLabel="Confirm Create Team"
          loading={isCreating} 
          disabled={!teamName.trim()}
          onPress={() => {
            createTeam(teamName, { onSuccess: () => setCreateModalOpen(false) });
          }} 
        />
      </Dialog>

      <Dialog visible={!!leaveDialog} title="Leave Team?" onClose={() => { if(!isLeaving) setLeaveDialog(null); }}>
        <Text className="mb-4 text-red-500">Are you sure you want to leave your team?</Text>
        <Button 
          title="Confirm Leave" 
          variant="danger"
          accessibilityLabel="Confirm Leave Team"
          loading={isLeaving} 
          onPress={() => leaveDialog && leaveTeam(leaveDialog, { onSuccess: () => setLeaveDialog(null) })} 
        />
      </Dialog>

      <Dialog visible={!!removeDialog} title="Remove Member?" onClose={() => { if(!isRemoving) setRemoveDialog(null); }}>
        <Text className="mb-4 text-red-500">Are you sure you want to remove this member?</Text>
        <Button 
          title="Confirm Remove" 
          variant="danger"
          accessibilityLabel="Confirm Remove Member"
          loading={isRemoving} 
          onPress={() => removeDialog && myTeam && removeMember({ teamId: myTeam.id, userId: removeDialog }, { onSuccess: () => setRemoveDialog(null) })} 
        />
      </Dialog>

      <Dialog visible={!!transferDialog} title="Transfer Leadership?" onClose={() => { if(!isTransferring) setTransferDialog(null); }}>
        <Text className="mb-4 text-orange-500">Transfer leadership to this member?</Text>
        <Button 
          title="Confirm Transfer" 
          variant="primary"
          accessibilityLabel="Confirm Transfer Leadership"
          loading={isTransferring} 
          onPress={() => transferDialog && myTeam && transferLeadership({ teamId: myTeam.id, newLeaderId: transferDialog }, { onSuccess: () => setTransferDialog(null) })} 
        />
      </Dialog>

      <Dialog visible={inviteModalOpen} title="Invite Member" onClose={() => { if(!isInviting) setInviteModalOpen(false); }}>
        <Input 
          placeholder="Search by name..." 
          value={searchQuery} 
          onChangeText={setSearchQuery} 
          accessibilityLabel="Search Invitees Input"
        />
        {isInviteesLoading ? (
          <ActivityIndicator size="small" style={{ marginVertical: 16 }} />
        ) : (
          <View className="mt-2 mb-4">
            {invitees?.length === 0 && searchQuery.length >= 2 ? (
              <Text className="text-gray-500 text-center py-2">No eligible students found.</Text>
            ) : null}
            {invitees?.map((invitee) => (
              <View key={invitee.user_id} className="flex-row items-center justify-between py-2 border-b border-gray-100">
                <View className="flex-row items-center">
                  <Avatar initials={invitee.display_name?.[0] || '?'} size={24} />
                  <Text className="ml-2">{invitee.display_name}</Text>
                </View>
                <Button 
                  title="Invite" 
                  size="small"
                  disabled={isInviting}
                  onPress={() => {
                    if (myTeam) {
                      inviteMember({ teamId: myTeam.id, inviteeId: invitee.user_id }, {
                        onSuccess: () => setInviteModalOpen(false)
                      });
                    }
                  }} 
                />
              </View>
            ))}
          </View>
        )}
        <Button 
          title="Cancel" 
          variant="secondary"
          disabled={isInviting}
          onPress={() => setInviteModalOpen(false)} 
        />
      </Dialog>

    </ScrollView>
  );
}
