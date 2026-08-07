import React, { useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../../../src/infrastructure/api';
import { useTeams } from '../../../../src/hooks/use-teams';
import { useAuthStore } from '../../../../src/store/auth';
import { Button, Card, EmptyState, Skeleton, Dialog, Input, Avatar, Divider, Banner } from '../../../../src/ui/primitives';
import { useNetworkStatus } from '../../../../src/infrastructure/network';

export default function TeamsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const currentUserId = useAuthStore(state => state.userId);
  const { isOnline } = useNetworkStatus();
  
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [teamName, setTeamName] = useState('');
  
  const [joinDialog, setJoinDialog] = useState<string | null>(null);
  const [leaveDialog, setLeaveDialog] = useState<string | null>(null);

  const { data: teams, isLoading } = useQuery({
    queryKey: ['teams', id],
    queryFn: () => apiClient(`/events/${id}/teams`),
  });

  const { createTeam, joinTeam, leaveTeam, isCreating, isJoining, isLeaving } = useTeams(id as string);

  // Purely presentational lookup for UI state
  const myTeam = teams?.find((t: any) => t.members?.some((m: any) => m.id === currentUserId));

  return (
    <ScrollView className="flex-1 bg-gray-50 p-4" accessibilityRole="scrollbar">
      {!isOnline && <Banner message="You are currently offline." type="error" accessibilityRole="alert" />}

      {isLoading ? (
        <View accessibilityRole="progressbar" accessibilityLabel="Loading teams">
          <Skeleton height={100} />
          <Skeleton height={100} />
        </View>
      ) : (
        <View>
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-xl font-bold" accessibilityRole="header">Teams</Text>
            {!myTeam && (
              <Button 
                title="Create Team" 
                accessibilityLabel="Create Team"
                disabled={!isOnline}
                onPress={() => setCreateModalOpen(true)} 
              />
            )}
          </View>

          {myTeam ? (
            <Card>
              <Text className="text-lg font-bold mb-2">My Team: {myTeam.name}</Text>
              <Divider />
              {myTeam.members?.map((member: any) => (
                <View key={member.id} className="flex-row items-center mb-2">
                  <Avatar initials={member.name?.[0] || '?'} size={32} />
                  <Text className="ml-2" accessibilityLabel={member.name}>{member.name}</Text>
                  {myTeam.leader_id === member.id && (
                    <Text className="ml-2" accessibilityLabel="Team Leader">👑</Text>
                  )}
                </View>
              ))}
              <View className="mt-4">
                <Button 
                  title="Leave Team" 
                  variant="danger" 
                  accessibilityLabel="Leave Team"
                  disabled={!isOnline}
                  onPress={() => setLeaveDialog(myTeam.id)} 
                />
              </View>
            </Card>
          ) : null}

          <Text className="text-lg font-bold mb-2 mt-4" accessibilityRole="header">All Teams</Text>
          {teams?.length === 0 ? (
            <EmptyState icon="👥" title="No teams formed yet" message="Be the first to create one!" />
          ) : (
            teams?.map((team: any) => (
              <Card key={team.id}>
                <View className="flex-row justify-between items-center">
                  <View>
                    <Text className="font-bold text-lg">{team.name}</Text>
                    <Text className="text-gray-500">{team.members?.length || 0} Members</Text>
                  </View>
                  {!myTeam && (
                    <Button 
                      title="Join" 
                      accessibilityLabel={`Join team ${team.name}`}
                      disabled={!isOnline}
                      onPress={() => setJoinDialog(team.id)} 
                    />
                  )}
                </View>
              </Card>
            ))
          )}
        </View>
      )}

      {/* Strict Pessimistic Dialogs */}
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
          onPress={() => {
            createTeam(teamName, { onSuccess: () => setCreateModalOpen(false) });
          }} 
        />
      </Dialog>

      <Dialog visible={!!joinDialog} title="Join Team?" onClose={() => { if(!isJoining) setJoinDialog(null); }}>
        <Text className="mb-4">Are you sure you want to join this team?</Text>
        <Button 
          title="Confirm Join" 
          accessibilityLabel="Confirm Join Team"
          loading={isJoining} 
          onPress={() => joinDialog && joinTeam(joinDialog, { onSuccess: () => setJoinDialog(null) })} 
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
    </ScrollView>
  );
}
