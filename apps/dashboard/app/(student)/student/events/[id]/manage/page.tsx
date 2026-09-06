'use client';

import React, { use } from 'react';
import { useEventDetail } from '../../../../../../hooks/useEventDetail';
import { useEventLifecycle } from '../../../../../../hooks/useEventLifecycle';
import { useCurrentUser } from '../../../../../../hooks/useCurrentUser';
import { resolveEventLockState } from '../../../../../../lib/event-utils';
import { Modal } from '../../../../../../components/ui/Modal';
import { Users, ShieldAlert, FileText, CheckCircle, Clock, AlertCircle, Lock, Edit2, Send, Unlock } from 'lucide-react';
import Link from 'next/link';
import clsx from 'clsx';
import { useRouter } from 'next/navigation';

export default function EventManageOverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: eventId } = use(params);
  const router = useRouter();
  const { data: event, isLoading } = useEventDetail(eventId);
  const { submitMutation, lockMutation, unlockMutation } = useEventLifecycle();
  const { data: currentUser } = useCurrentUser();

  const [isLockModalOpen, setIsLockModalOpen] = React.useState(false);
  const [isUnlockModalOpen, setIsUnlockModalOpen] = React.useState(false);

  const isClubAdmin = React.useMemo(() => {
    if (!event || !currentUser) return false;
    const primaryClubId = event.eventClubs?.find((ec: any) => ec.isPrimary)?.clubId;
    if (!primaryClubId) return false;
    const membership = currentUser.club_memberships.find((m: any) => m.club_id === primaryClubId);
    return membership?.role === 'CLUB_ADMIN';
  }, [event, currentUser]);

  if (isLoading || !event) return null;

  const lockState = resolveEventLockState(event);
  const showLockEvent = event.state === 'PUBLISHED' && isClubAdmin && lockState === 'UNLOCKED';
  const showUnlockEvent = event.state === 'PUBLISHED' && isClubAdmin && lockState === 'MANUALLY_LOCKED';

  const handleSubmitForApproval = () => {
    if (confirm('Are you sure you want to submit this event for approval? You will no longer be able to edit it.')) {
      submitMutation.mutate(eventId);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* State Call to Actions */}
      {event.state === 'DRAFT' && (
        <div className="p-6 border border-yellow-600 bg-yellow-50 dark:bg-yellow-900/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-mono font-bold text-yellow-800 dark:text-yellow-500 uppercase tracking-widest mb-1 flex items-center gap-2">
              <FileText className="w-4 h-4" /> Event is Draft
            </h3>
            <p className="text-sm text-yellow-700 dark:text-yellow-600 font-mono">Review your event details before submitting for approval.</p>
          </div>
          <div className="flex gap-4 w-full sm:w-auto">
            <Link 
              href={`/student/events/${eventId}/manage/edit`}
              className="flex-1 sm:flex-none px-6 py-3 border border-yellow-600 text-yellow-800 dark:text-yellow-500 font-mono font-bold text-xs tracking-widest hover:bg-yellow-600 hover:text-white transition-colors uppercase whitespace-nowrap text-center flex items-center justify-center gap-2"
            >
              <Edit2 className="w-4 h-4" /> Edit Draft
            </Link>
            <button 
              onClick={handleSubmitForApproval}
              disabled={submitMutation.isPending}
              className="flex-1 sm:flex-none px-6 py-3 bg-yellow-600 text-white font-mono font-bold text-xs tracking-widest hover:bg-yellow-700 transition-colors uppercase disabled:opacity-50 whitespace-nowrap flex items-center justify-center gap-2"
            >
              <Send className="w-4 h-4" />
              {submitMutation.isPending ? 'Submitting...' : 'Submit for Approval'}
            </button>
          </div>
        </div>
      )}

      {event.state === 'PENDING_APPROVAL' && (
        <div className="p-6 border border-blue-600 bg-blue-50 dark:bg-blue-900/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-mono font-bold text-blue-800 dark:text-blue-400 uppercase tracking-widest mb-1 flex items-center gap-2">
              <Clock className="w-4 h-4" /> Awaiting Approval
            </h3>
            <p className="text-sm text-blue-700 dark:text-blue-500 font-mono">This event has been submitted and is waiting for higher admin approval. It is currently locked for editing.</p>
          </div>
        </div>
      )}

      {event.state === 'PUBLISHED' && (
        <div className="p-6 border border-green-600 bg-green-50 dark:bg-green-900/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-mono font-bold text-green-800 dark:text-green-500 uppercase tracking-widest mb-1 flex items-center gap-2">
              <CheckCircle className="w-4 h-4" /> Published
            </h3>
            <p className="text-sm text-green-700 dark:text-green-600 font-mono">This event is live and visible to students.</p>
          </div>
        </div>
      )}

      {event.state === 'REJECTED' && (
        <div className="p-6 border border-red-600 bg-red-50 dark:bg-red-900/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-mono font-bold text-red-800 dark:text-red-500 uppercase tracking-widest mb-1 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" /> Rejected
            </h3>
            <p className="text-sm text-red-700 dark:text-red-600 font-mono">
              This event was rejected during the approval process.
              {/* Note: if backend exposes rejection_reason in metadata, it would be displayed here */}
              {(event.metadata as any)?.rejection_reason && (
                <span className="block mt-2 font-bold">Reason: {(event.metadata as any).rejection_reason}</span>
              )}
            </p>
          </div>
        </div>
      )}

      {event.state === 'ARCHIVED' && (
        <div className="p-6 border border-gray-600 bg-gray-50 dark:bg-gray-900/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-mono font-bold text-gray-800 dark:text-gray-400 uppercase tracking-widest mb-1 flex items-center gap-2">
              <Lock className="w-4 h-4" /> Archived
            </h3>
            <p className="text-sm text-gray-700 dark:text-gray-500 font-mono">This event is archived and is read-only.</p>
          </div>
        </div>
      )}

      {/* EVENT LIFECYCLE (LOCK / UNLOCK) */}
      {(showLockEvent || showUnlockEvent || lockState === 'PERMANENTLY_LOCKED') && (
        <div className="p-6 border border-stitch-outline-variant bg-stitch-surface flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-mono font-bold text-stitch-on-surface uppercase tracking-widest mb-1 flex items-center gap-2">
              {lockState === 'UNLOCKED' ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
              Event Lifecycle
            </h3>
            <p className="text-sm text-stitch-secondary font-mono">
              {lockState === 'UNLOCKED' ? 'This event is live and active mutations are allowed.' :
               lockState === 'MANUALLY_LOCKED' ? 'This event is manually locked. Registration and team operations are frozen.' :
               'This event is permanently locked (ended over 24h ago). Operations are permanently frozen.'}
            </p>
          </div>
          <div className="flex gap-4 w-full sm:w-auto">
            {showLockEvent && (
              <button 
                onClick={() => setIsLockModalOpen(true)}
                disabled={lockMutation.isPending}
                className="flex-1 sm:flex-none px-6 py-3 bg-red-600 text-white font-mono font-bold text-xs tracking-widest hover:bg-red-700 transition-colors uppercase disabled:opacity-50 whitespace-nowrap flex items-center justify-center gap-2"
              >
                <Lock className="w-4 h-4" />
                {lockMutation.isPending ? 'Locking...' : 'Lock Event'}
              </button>
            )}
            {showUnlockEvent && (
              <button 
                onClick={() => setIsUnlockModalOpen(true)}
                disabled={unlockMutation.isPending}
                className="flex-1 sm:flex-none px-6 py-3 bg-stitch-primary text-white font-mono font-bold text-xs tracking-widest hover:bg-stitch-primary/90 transition-colors uppercase disabled:opacity-50 whitespace-nowrap flex items-center justify-center gap-2"
              >
                <Unlock className="w-4 h-4" />
                {unlockMutation.isPending ? 'Unlocking...' : 'Unlock Event'}
              </button>
            )}
            {lockState !== 'UNLOCKED' && !showUnlockEvent && (
              <div className="px-6 py-3 border border-stitch-outline-variant bg-stitch-surface-variant text-stitch-secondary font-mono font-bold text-xs tracking-widest uppercase whitespace-nowrap flex items-center justify-center">
                LOCKED — READ-ONLY
              </div>
            )}
          </div>
        </div>
      )}

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className="p-5 border border-stitch-outline-variant bg-stitch-surface flex flex-col justify-between">
          <div className="flex items-center gap-2 text-stitch-secondary mb-4">
            <Users className="w-4 h-4" />
            <span className="text-[10px] font-mono uppercase tracking-widest">Registrations</span>
          </div>
          <div className="text-3xl font-bold text-stitch-on-surface">
            {event.registrationCount}
            {event.maxCapacity && <span className="text-lg text-stitch-secondary ml-1">/ {event.maxCapacity}</span>}
          </div>
        </div>

        {event.registrationType === 'TEAM' && (
          <div className="p-5 border border-stitch-outline-variant bg-stitch-surface flex flex-col justify-between">
            <div className="flex items-center gap-2 text-stitch-secondary mb-4">
              <ShieldAlert className="w-4 h-4" />
              <span className="text-[10px] font-mono uppercase tracking-widest">Teams</span>
            </div>
            <div className="text-3xl font-bold text-stitch-on-surface">
              {/* Teams Count placeholder */}
              --
            </div>
          </div>
        )}

      </div>

      {/* Lock Modal */}
      <Modal 
        isOpen={isLockModalOpen} 
        onClose={() => !lockMutation.isPending && setIsLockModalOpen(false)} 
        title="LOCK EVENT"
      >
        <div className="p-6 space-y-6">
          <p className="text-sm text-stitch-secondary font-sans leading-relaxed">
            Are you sure you want to lock this event? Locking will freeze all registrations and team operations.
          </p>
          {lockMutation.isError && (
            <div className="p-4 bg-red-900/20 border border-red-500/50 text-red-500 text-xs font-mono">
              {(lockMutation.error as any)?.data?.error || lockMutation.error?.message || 'Failed to lock event'}
            </div>
          )}
          <div className="flex items-center justify-end gap-4 pt-4 border-t border-stitch-outline-variant">
            <button 
              onClick={() => setIsLockModalOpen(false)}
              disabled={lockMutation.isPending}
              className="px-6 py-3 text-xs font-mono font-bold tracking-widest text-stitch-secondary hover:text-stitch-on-surface uppercase transition-colors"
            >
              Cancel
            </button>
            <button 
              onClick={() => {
                lockMutation.mutate(eventId, {
                  onSuccess: () => setIsLockModalOpen(false)
                });
              }}
              disabled={lockMutation.isPending}
              className="px-6 py-3 text-xs font-mono font-bold tracking-widest bg-red-600 hover:bg-red-700 text-white uppercase transition-colors disabled:opacity-50"
            >
              {lockMutation.isPending ? 'Locking...' : 'Lock Event'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Unlock Modal */}
      <Modal 
        isOpen={isUnlockModalOpen} 
        onClose={() => !unlockMutation.isPending && setIsUnlockModalOpen(false)} 
        title="UNLOCK EVENT"
      >
        <div className="p-6 space-y-6">
          <p className="text-sm text-stitch-secondary font-sans leading-relaxed">
            Are you sure you want to unlock this event? This will re-enable registrations and team operations.
          </p>
          {unlockMutation.isError && (
            <div className="p-4 bg-red-900/20 border border-red-500/50 text-red-500 text-xs font-mono">
              {(unlockMutation.error as any)?.data?.error || unlockMutation.error?.message || 'Failed to unlock event'}
            </div>
          )}
          <div className="flex items-center justify-end gap-4 pt-4 border-t border-stitch-outline-variant">
            <button 
              onClick={() => setIsUnlockModalOpen(false)}
              disabled={unlockMutation.isPending}
              className="px-6 py-3 text-xs font-mono font-bold tracking-widest text-stitch-secondary hover:text-stitch-on-surface uppercase transition-colors"
            >
              Cancel
            </button>
            <button 
              onClick={() => {
                unlockMutation.mutate(eventId, {
                  onSuccess: () => setIsUnlockModalOpen(false)
                });
              }}
              disabled={unlockMutation.isPending}
              className="px-6 py-3 text-xs font-mono font-bold tracking-widest bg-stitch-primary hover:bg-stitch-primary/90 text-white uppercase transition-colors disabled:opacity-50"
            >
              {unlockMutation.isPending ? 'Unlocking...' : 'Unlock Event'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
