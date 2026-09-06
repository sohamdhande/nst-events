'use client';

import { use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, LogOut, Info } from 'lucide-react';
import { useEventDetail, useMyRegistration } from '../../../../../../hooks/useEventDetail';
import { useTeamLookup, useLeaveTeam } from '../../../../../../hooks/useTeams';
import { useCurrentUser } from '../../../../../../hooks/useCurrentUser';
import { Modal } from '../../../../../../components/ui/Modal';
import { TransferLeadershipModal } from './components/TransferLeadershipModal';
import { useState } from 'react';

export default function TeamHubPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: eventId } = use(params);
  const router = useRouter();

  const { data: event, isLoading: isLoadingEvent } = useEventDetail(eventId);
  const { data: registration, isLoading: isLoadingReg } = useMyRegistration(eventId);
  const { data: currentUser } = useCurrentUser();

  // Redirect to event detail if not a team event
  if (event && event.registrationType !== 'TEAM') {
    router.push(`/student/events/${eventId}`);
  }

  // Determine team ID to lookup
  const teamId = registration?.team_id;

  const { data: team, isLoading: isLoadingTeam } = useTeamLookup(teamId);
  const { mutate: leaveTeam, isPending: isLeaving } = useLeaveTeam(eventId);

  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);

  // Grouped loading
  if (isLoadingEvent || isLoadingReg || isLoadingTeam) {
    return (
      <div className="w-full flex-grow flex justify-center items-center h-64">
        <div className="animate-pulse flex flex-col items-center">
          <div className="h-8 w-8 border-4 border-stitch-on-surface border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-sm font-medium text-stitch-secondary uppercase tracking-widest font-mono">Loading Team Hub...</p>
        </div>
      </div>
    );
  }

  if (!event) return null;

  // Locks and Status
  const dbNow = new Date();
  const isPermanentLock = new Date(event.endTime).getTime() + 24 * 60 * 60 * 1000 <= dbNow.getTime();
  const isLocked = event.lock_state !== 'UNLOCKED' || isPermanentLock || new Date(event.endTime) <= dbNow;

  const isLeader = team?.leader_id === currentUser?.id;
  const teamStatus = team?.status || 'UNKNOWN';
  
  const isBelowMinimum = team?.below_minimum === true;

  const handleLeaveConfirm = () => {
    if (!team) return;
    leaveTeam(team.id, {
      onSuccess: () => {
        setIsLeaveModalOpen(false);
        router.push(`/student/events/${eventId}`);
      }
    });
  };

  const statusColors = {
    FORMING: 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-200 dark:border-yellow-700/50',
    REGISTERED: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-200 dark:border-green-700/50',
    WAITLISTED: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-200 dark:border-blue-700/50',
    CANCELLED: 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-900/30 dark:text-gray-200 dark:border-gray-700/50',
    UNKNOWN: 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-900/30 dark:text-gray-200 dark:border-gray-700/50',
  };

  const statusColor = statusColors[teamStatus as keyof typeof statusColors] || statusColors.UNKNOWN;

  return (
    <div className="w-full flex-grow bg-stitch-surface-container-lowest text-stitch-on-surface font-sans min-h-screen">
      
      {/* TRANSFER LEADERSHIP MODAL */}
      {team && (
        <TransferLeadershipModal
          eventId={eventId}
          team={team}
          isOpen={isTransferModalOpen}
          onClose={() => setIsTransferModalOpen(false)}
        />
      )}

      {/* LEAVE TEAM MODAL */}
      <Modal isOpen={isLeaveModalOpen} onClose={() => !isLeaving && setIsLeaveModalOpen(false)} title="LEAVE TEAM">
        <div className="p-6 pt-0">
          <p className="text-base text-stitch-on-surface-variant mb-8 leading-relaxed">
            {isLeader 
              ? "You are the team leader. You must transfer leadership before you can leave the team, or cancel the team registration entirely if you are the only member."
              : `Are you sure you want to leave ${team?.name}? This action cannot be undone.`}
          </p>

          <div className="flex flex-col sm:flex-row gap-4">
            <button 
              onClick={() => setIsLeaveModalOpen(false)}
              disabled={isLeaving}
              className="w-full sm:w-auto px-6 py-3 border border-stitch-on-surface text-stitch-on-surface font-mono font-bold text-sm tracking-widest hover:bg-stitch-surface transition-colors uppercase disabled:opacity-50"
            >
              Cancel
            </button>
            <button 
              onClick={handleLeaveConfirm}
              disabled={isLeaving || (isLeader && team!.member_count > 1)}
              className="w-full sm:flex-1 px-6 py-3 bg-red-600 text-white font-mono font-bold text-sm tracking-widest hover:bg-red-700 transition-colors uppercase disabled:opacity-50"
            >
              {isLeaving ? 'Processing...' : 'Leave Team'}
            </button>
          </div>
        </div>
      </Modal>

      <div className="w-full max-w-[1440px] mx-auto px-6 py-6 md:px-12 md:py-8 lg:px-16">
        
        {/* Back Link */}
        <Link 
          href={`/student/events/${eventId}`}
          className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-widest text-stitch-on-surface hover:text-stitch-secondary transition-colors mb-4 inline-flex"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Event
        </Link>

        {isLocked && (
          <div className="w-full text-center px-4 py-2.5 mb-6 bg-stitch-surface-variant text-stitch-secondary font-mono font-bold text-xs tracking-widest uppercase border border-stitch-outline-variant">
            Event Locked — Read Only
          </div>
        )}

        {!team ? (
          <div className="text-center py-16 border border-stitch-outline-variant">
            <p className="text-stitch-secondary mb-4">You are not in a team for this event.</p>
            <Link 
              href={`/student/events/${eventId}`}
              className="inline-flex items-center justify-center px-6 py-3.5 bg-stitch-on-surface text-stitch-surface-container-lowest font-mono font-bold text-xs tracking-widest hover:opacity-80 transition-colors uppercase"
            >
              Return to Event
            </Link>
          </div>
        ) : (
          /* 2-Column Desktop Composition (Left ~68%, Right ~32%) */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
            
            {/* Left Column (Primary Team Content) */}
            <div className="lg:col-span-7 xl:col-span-8 space-y-8">
              
              {/* Compact Team Header */}
              <div className="border-b border-stitch-outline-variant pb-6 mb-6">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-2">
                  <div>
                    <h1 
                      className="text-3xl sm:text-4xl md:text-[44px] font-black text-stitch-on-surface tracking-tight leading-tight break-words"
                      style={{ fontFamily: 'Syne, sans-serif' }}
                    >
                      {team.name}
                    </h1>
                    <div className="text-sm md:text-base text-stitch-on-surface-variant mt-1">
                      Team for <span className="font-semibold text-stitch-on-surface">{event.title}</span>
                    </div>
                  </div>
                  <div className={`px-3 py-1 border text-[11px] font-mono font-bold tracking-widest uppercase rounded-full flex-shrink-0 self-start sm:self-auto ${statusColor}`}>
                    {teamStatus}
                  </div>
                </div>
              </div>

              {/* Below Minimum Warning */}
              {isBelowMinimum && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 flex items-start gap-3 text-yellow-800 text-xs mb-6 dark:bg-yellow-900/30 dark:text-yellow-200 dark:border-yellow-700/50">
                  <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold uppercase tracking-wider mb-0.5">Below Minimum Size</h4>
                    <p className="leading-relaxed">Other students must join your team to meet the minimum.</p>
                  </div>
                </div>
              )}

              {/* Members Section */}
              <section>
                <div className="flex items-center justify-between border-b border-stitch-outline-variant pb-2 mb-3">
                  <h2 className="text-xs font-mono font-bold tracking-[0.2em] text-stitch-on-surface uppercase">
                    Members ({team.member_count}{event.metadata?.maximum_team_size ? `/${event.metadata.maximum_team_size}` : ''})
                  </h2>
                </div>
                <div className="space-y-2">
                  {team.members?.map((member) => (
                    <div key={member.user_id} className="flex items-center justify-between px-4 py-2.5 border border-stitch-outline-variant hover:border-stitch-outline transition-colors bg-stitch-surface-container-lowest">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-stitch-surface-variant flex items-center justify-center rounded-full border border-stitch-outline-variant text-stitch-on-surface text-xs font-semibold">
                          {member.full_name ? member.full_name.charAt(0) : 'U'}
                        </div>
                        <span className="text-sm font-medium text-stitch-on-surface">{member.full_name || 'Unknown User'}</span>
                      </div>
                      <div className="flex gap-2">
                        {member.user_id === team.leader_id && (
                          <span className="px-2.5 py-0.5 bg-stitch-on-surface text-stitch-surface-container-lowest text-[10px] font-mono font-bold tracking-widest uppercase rounded-full">
                            Leader
                          </span>
                        )}
                        {member.user_id === currentUser?.id && (
                          <span className="px-2.5 py-0.5 bg-stitch-surface-variant text-stitch-on-surface text-[10px] font-mono font-bold tracking-widest uppercase rounded-full">
                            You
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Danger Zone Actions */}
              <section>
                <h2 className="text-xs font-mono font-bold tracking-[0.2em] text-red-600 dark:text-red-500 uppercase border-b border-red-200 dark:border-red-900/50 pb-2 mb-3">
                  Danger Zone
                </h2>
                
                <div className="flex flex-col gap-3">
                  {isLeader && (
                    <button 
                      onClick={() => setIsTransferModalOpen(true)}
                      disabled={isLocked || team.member_count <= 1}
                      className="w-full flex items-center justify-between p-4 border border-stitch-outline-variant hover:border-stitch-on-surface transition-colors disabled:opacity-50 disabled:hover:border-stitch-outline-variant text-left"
                    >
                      <div>
                        <div className="text-sm font-semibold text-stitch-on-surface">Transfer Leadership</div>
                        <div className="text-xs text-stitch-secondary">Make another member the team leader</div>
                      </div>
                      <div className="text-stitch-on-surface text-sm">→</div>
                    </button>
                  )}

                  <button 
                    onClick={() => setIsLeaveModalOpen(true)}
                    disabled={isLocked}
                    className="w-full flex items-center justify-between p-4 border border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-900/20 hover:bg-red-100/80 dark:hover:bg-red-900/40 transition-colors group disabled:opacity-50 text-left"
                  >
                    <div>
                      <div className="text-sm font-semibold text-red-700 dark:text-red-400">Leave Team</div>
                      <div className="text-xs text-red-600/70 dark:text-red-400/70">Remove yourself from this team</div>
                    </div>
                    <LogOut className="w-4 h-4 text-red-600 dark:text-red-500 group-hover:-translate-x-0.5 transition-transform" />
                  </button>
                </div>
              </section>
            </div>

            {/* Right Column (Compact Team Overview Rail) */}
            <div className="lg:col-span-5 xl:col-span-4 space-y-8">
              <div>
                <h3 className="text-xs font-mono font-bold tracking-[0.2em] text-stitch-secondary uppercase border-b border-stitch-outline-variant pb-2 mb-4">
                  Team Overview
                </h3>
                
                <div className="space-y-4">
                  <div>
                    <div className="text-[11px] font-mono text-stitch-secondary uppercase mb-0.5">Event</div>
                    <div className="text-sm font-medium text-stitch-on-surface break-words">{event.title}</div>
                  </div>

                  <div>
                    <div className="text-[11px] font-mono text-stitch-secondary uppercase mb-0.5">Team Size</div>
                    <div className="text-sm font-medium text-stitch-on-surface">
                      {team.member_count} {event.metadata?.maximum_team_size ? `/ ${event.metadata.maximum_team_size}` : ''} <span className="text-stitch-secondary font-normal">Members</span>
                    </div>
                  </div>

                  {event.metadata?.minimum_team_size && (
                    <div>
                      <div className="text-[11px] font-mono text-stitch-secondary uppercase mb-0.5">Required Minimum</div>
                      <div className="text-sm font-medium text-stitch-on-surface">{event.metadata.minimum_team_size} members</div>
                    </div>
                  )}

                  {event.metadata?.maximum_team_size && (
                    <div>
                      <div className="text-[11px] font-mono text-stitch-secondary uppercase mb-0.5">Maximum Capacity</div>
                      <div className="text-sm font-medium text-stitch-on-surface">{event.metadata.maximum_team_size} members</div>
                    </div>
                  )}

                  <div>
                    <div className="text-[11px] font-mono text-stitch-secondary uppercase mb-0.5">Status</div>
                    <div className="text-sm font-medium text-stitch-on-surface uppercase font-mono">{teamStatus}</div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}


