import React, { useState } from 'react';
import { useCreateTeam, useTeamsList, useJoinTeam, Team } from '../../../../../../hooks/useTeams';
import { Modal } from '../../../../../../components/ui/Modal';
import { useRouter } from 'next/navigation';
import { Users, UserPlus } from 'lucide-react';

interface TeamGatewayModalProps {
  eventId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function TeamGatewayModal({ eventId, isOpen, onClose }: TeamGatewayModalProps) {
  const router = useRouter();
  const [view, setView] = useState<'GATEWAY' | 'CREATE' | 'JOIN' | 'CONFIRM_JOIN'>('GATEWAY');
  
  const [teamName, setTeamName] = useState('');
  const [teamNameError, setTeamNameError] = useState<string | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);

  const { mutate: createTeam, isPending: isCreating } = useCreateTeam(eventId);
  const { mutate: joinTeam, isPending: isJoining } = useJoinTeam(eventId);
  
  const { data: teamsData, isLoading: isLoadingTeams } = useTeamsList(eventId);

  // Debounced local validation
  React.useEffect(() => {
    const handler = setTimeout(() => {
      const normalizedInput = teamName.trim().toLowerCase();
      if (!normalizedInput || !teamsData?.pages) {
        setTeamNameError(null);
        return;
      }
      
      const allLoadedTeams = teamsData.pages.flatMap((page: any) => page.data);
      if (allLoadedTeams.some((t: Team) => t.name.trim().toLowerCase() === normalizedInput)) {
        setTeamNameError('This team name is already taken.');
      } else {
        setTeamNameError(null);
      }
    }, 500);

    return () => clearTimeout(handler);
  }, [teamName, teamsData]);

  const handleCreate = () => {
    if (!teamName.trim()) return;
    const normalizedInput = teamName.trim().toLowerCase();
    
    // Local uniqueness check against loaded teams
    if (teamsData?.pages) {
      const allLoadedTeams = teamsData.pages.flatMap((page: any) => page.data);
      if (allLoadedTeams.some((t: Team) => t.name.trim().toLowerCase() === normalizedInput)) {
        setTeamNameError('This team name is already taken.');
        return;
      }
    }

    createTeam({ name: teamName.trim() }, {
      onSuccess: () => {
        onClose();
        router.push(`/student/events/${eventId}/team`);
      },
      onError: (err: any) => {
        // Handle 409 or U0055
        if (err.status === 409 || err.message?.includes('TEAM_NAME_TAKEN') || err.message?.includes('taken')) {
          setTeamNameError('This team name is already taken for this event.');
        } else {
          setTeamNameError(err.message || 'Failed to create team. Please try again.');
        }
      }
    });
  };

  const handleJoin = () => {
    if (!selectedTeam) return;
    joinTeam(selectedTeam.id, {
      onSuccess: () => {
        onClose();
        router.push(`/student/events/${eventId}/team`);
      }
    });
  };

  const reset = () => {
    setView('GATEWAY');
    setTeamName('');
    setSelectedTeam(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={view === 'CREATE' ? 'CREATE TEAM' : view === 'JOIN' ? 'JOIN TEAM' : 'TEAM REGISTRATION'}>
      <div className="p-6 pt-0">
        
        {view === 'GATEWAY' && (
          <div className="space-y-4">
            <p className="text-stitch-on-surface-variant mb-6">You can participate in this event as part of a team. Create a new team or join an existing one.</p>
            
            <button
              onClick={() => setView('CREATE')}
              className="w-full flex items-center justify-between p-6 border border-stitch-outline-variant hover:border-stitch-on-surface transition-colors group"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-stitch-on-surface text-stitch-surface-container-lowest flex items-center justify-center">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <div className="font-semibold text-stitch-on-surface">Create a Team</div>
                  <div className="text-sm text-stitch-secondary">You will be the team leader</div>
                </div>
              </div>
              <div className="text-stitch-on-surface group-hover:translate-x-1 transition-transform">→</div>
            </button>

            <button
              onClick={() => setView('JOIN')}
              className="w-full flex items-center justify-between p-6 border border-stitch-outline-variant hover:border-stitch-on-surface transition-colors group"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-stitch-surface-variant text-stitch-on-surface flex items-center justify-center">
                  <Users className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <div className="font-semibold text-stitch-on-surface">Join Existing Team</div>
                  <div className="text-sm text-stitch-secondary">Browse and join an open team</div>
                </div>
              </div>
              <div className="text-stitch-on-surface group-hover:translate-x-1 transition-transform">→</div>
            </button>
          </div>
        )}

        {view === 'CREATE' && (
          <div>
            <div className="mb-8">
              <label className="block text-xs font-mono font-bold tracking-widest uppercase text-stitch-on-surface mb-2">
                Team Name
              </label>
              <input
                type="text"
                value={teamName}
                onChange={(e) => {
                  setTeamName(e.target.value);
                  setTeamNameError(null);
                }}
                placeholder="Enter a creative team name..."
                className={`w-full p-4 border focus:outline-none transition-colors text-lg bg-stitch-surface-container-lowest text-stitch-on-surface ${teamNameError ? 'border-red-500 focus:border-red-500 bg-red-50 dark:bg-red-900/30' : 'border-stitch-outline-variant focus:border-stitch-on-surface'}`}
                autoFocus
              />
              {teamNameError && (
                <div className="text-sm text-red-600 font-medium mt-2">{teamNameError}</div>
              )}
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4">
              <button 
                onClick={() => setView('GATEWAY')}
                disabled={isCreating}
                className="w-full sm:w-auto px-6 py-3 border border-stitch-on-surface text-stitch-on-surface font-mono font-bold text-sm tracking-widest hover:bg-stitch-surface transition-colors uppercase disabled:opacity-50"
              >
                Back
              </button>
              <button 
                onClick={handleCreate}
                disabled={!teamName.trim() || isCreating}
                className="w-full sm:flex-1 px-6 py-3 bg-stitch-on-surface text-stitch-surface-container-lowest font-mono font-bold text-sm tracking-widest hover:opacity-80 transition-colors uppercase disabled:opacity-50"
              >
                {isCreating ? 'Creating...' : 'Create Team'}
              </button>
            </div>
          </div>
        )}

        {view === 'JOIN' && (
          <div className="flex flex-col h-[50vh] max-h-[400px]">
            <div className="flex-1 overflow-y-auto pr-2 space-y-3 mb-6">
              {isLoadingTeams ? (
                <div className="flex justify-center items-center h-full">
                  <div className="animate-pulse h-6 w-6 border-2 border-stitch-on-surface border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : teamsData?.pages[0]?.data.length === 0 ? (
                <div className="text-center text-stitch-secondary py-8">No teams available to join.</div>
              ) : (
                teamsData?.pages.flatMap((page: any) => page.data).map((team: Team) => {
                  const isCancelled = team.status === 'CANCELLED';
                  const isFull = false; // We don't have capacity from this hook, rely on backend or add it if needed. Assuming the backend only returns joinable teams per the spec ("student-safe team list returned by the backend"). 

                  return (
                    <button
                      key={team.id}
                      onClick={() => {
                        setSelectedTeam(team);
                        setView('CONFIRM_JOIN');
                      }}
                      disabled={isCancelled || isFull}
                      className="w-full flex items-center justify-between p-4 border border-stitch-outline-variant hover:border-stitch-on-surface transition-colors disabled:opacity-50 disabled:hover:border-stitch-outline-variant text-left"
                    >
                      <div>
                        <div className="font-semibold text-stitch-on-surface">{team.name}</div>
                        <div className="text-xs text-stitch-secondary mt-1">Leader: {team.leader_name} • {team.member_count} members</div>
                      </div>
                      <div className="text-stitch-on-surface">→</div>
                    </button>
                  );
                })
              )}
            </div>
            
            <button 
              onClick={() => setView('GATEWAY')}
              className="w-full px-6 py-3 border border-stitch-on-surface text-stitch-on-surface font-mono font-bold text-sm tracking-widest hover:bg-stitch-surface transition-colors uppercase"
            >
              Back
            </button>
          </div>
        )}

        {view === 'CONFIRM_JOIN' && selectedTeam && (
          <div>
            <p className="text-base text-stitch-on-surface-variant mb-8 leading-relaxed">
              Are you sure you want to join <span className="font-semibold text-stitch-on-surface">{selectedTeam.name}</span>?
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <button 
                onClick={() => setView('JOIN')}
                disabled={isJoining}
                className="w-full sm:w-auto px-6 py-3 border border-stitch-on-surface text-stitch-on-surface font-mono font-bold text-sm tracking-widest hover:bg-stitch-surface transition-colors uppercase disabled:opacity-50"
              >
                Back
              </button>
              <button 
                onClick={handleJoin}
                disabled={isJoining}
                className="w-full sm:flex-1 px-6 py-3 bg-stitch-on-surface text-stitch-surface-container-lowest font-mono font-bold text-sm tracking-widest hover:opacity-80 transition-colors uppercase disabled:opacity-50"
              >
                {isJoining ? 'Joining...' : 'Confirm Join'}
              </button>
            </div>
          </div>
        )}

      </div>
    </Modal>
  );
}
