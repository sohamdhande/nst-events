import React, { useState } from 'react';
import { useTransferLeadership, Team, TeamMember } from '../../../../../../../hooks/useTeams';
import { Modal } from '../../../../../../../components/ui/Modal';

interface TransferLeadershipModalProps {
  eventId: string;
  team: Team;
  isOpen: boolean;
  onClose: () => void;
}

export function TransferLeadershipModal({ eventId, team, isOpen, onClose }: TransferLeadershipModalProps) {
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { mutate: transferLeadership, isPending } = useTransferLeadership(eventId);

  const eligibleMembers = team.members.filter((m: TeamMember) => m.user_id !== team.leader_id);

  if (!isOpen) return null;

  const handleTransfer = () => {
    setErrorMsg(null);
    if (!selectedMemberId) {
      setErrorMsg('Please select a member to transfer leadership to.');
      return;
    }

    transferLeadership(
      { teamId: team.id, newLeaderId: selectedMemberId },
      {
        onSuccess: () => {
          onClose();
          setSelectedMemberId(null);
        },
        onError: (err: any) => {
          setErrorMsg(err.message || 'Failed to transfer leadership. Please try again.');
        },
      }
    );
  };

  const handleClose = () => {
    if (!isPending) {
      onClose();
      setSelectedMemberId(null);
      setErrorMsg(null);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="TRANSFER LEADERSHIP">
      <div className="p-6 pt-0">
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm font-sans dark:bg-yellow-900/30 dark:border-yellow-700/50 dark:text-yellow-200" role="alert">
          <p className="font-bold mb-1 uppercase tracking-widest text-xs font-mono">Warning: Permanent Action</p>
          <p>If you transfer leadership, you will become a regular team member and lose the ability to manage this team.</p>
        </div>

        {errorMsg && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-600 text-sm font-sans dark:bg-red-900/30 dark:border-red-700/50 dark:text-red-300" role="alert">
            {errorMsg}
          </div>
        )}

        <div className="mb-8">
          <h3 className="text-xs font-mono font-bold tracking-[0.2em] text-stitch-secondary uppercase mb-3">Select New Leader</h3>
          
          {eligibleMembers.length === 0 ? (
            <p className="text-sm text-stitch-on-surface-variant">There are no other members in this team.</p>
          ) : (
            <div className="space-y-2">
              {eligibleMembers.map((member: TeamMember) => (
                <button
                  key={member.user_id}
                  onClick={() => setSelectedMemberId(member.user_id)}
                  disabled={isPending}
                  className={`w-full flex items-center justify-between p-4 border transition-colors text-left disabled:opacity-50 ${
                    selectedMemberId === member.user_id 
                      ? 'border-stitch-on-surface bg-stitch-surface text-stitch-on-surface' 
                      : 'border-stitch-outline-variant text-stitch-on-surface hover:border-stitch-on-surface/50'
                  }`}
                >
                  <div className="font-semibold text-sm">{member.full_name}</div>
                  {selectedMemberId === member.user_id && (
                    <div className="w-3 h-3 bg-stitch-on-surface flex-shrink-0"></div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <button 
            onClick={handleClose}
            disabled={isPending}
            className="w-full sm:w-auto px-6 py-3 border border-stitch-on-surface text-stitch-on-surface font-mono font-bold text-sm tracking-widest hover:bg-stitch-surface transition-colors uppercase disabled:opacity-50"
          >
            Cancel
          </button>
          <button 
            onClick={handleTransfer}
            disabled={!selectedMemberId || isPending}
            className="w-full sm:flex-1 px-6 py-3 bg-red-600 text-white font-mono font-bold text-sm tracking-widest hover:bg-red-700 transition-colors uppercase disabled:opacity-50 flex items-center justify-center"
          >
            {isPending ? 'Processing...' : 'Confirm Transfer'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
