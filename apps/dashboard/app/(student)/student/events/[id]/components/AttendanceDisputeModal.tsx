import React, { useState } from 'react';
import { useSubmitAttendanceDispute } from '../../../../../../hooks/useAttendance';

interface AttendanceDisputeModalProps {
  isOpen: boolean;
  onClose: () => void;
  eventId: string;
  sessionId: string;
}

export function AttendanceDisputeModal({ isOpen, onClose, eventId, sessionId }: AttendanceDisputeModalProps) {
  const [reason, setReason] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const { mutate: submitDispute, isPending } = useSubmitAttendanceDispute(eventId);

  if (!isOpen) return null;

  const handleSubmit = () => {
    setErrorMsg(null);
    if (!reason.trim()) {
      setErrorMsg('A reason is required to submit a dispute.');
      return;
    }

    submitDispute(
      { session_id: sessionId, reason: reason.trim() },
      {
        onSuccess: () => {
          onClose();
          setReason('');
        },
        onError: (err: any) => {
          if (err?.data?.error?.code === 'U0048' || err?.data?.code === 'U0048') {
            setErrorMsg('Dispute window expired.');
          } else if (err?.data?.error?.code === 'U0054' || err?.data?.code === 'U0054') {
            setErrorMsg('Attendance already recorded.');
          } else {
            setErrorMsg(err.message || 'Failed to submit dispute. Please try again.');
          }
        },
      }
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" role="dialog" aria-modal="true">
      <div className="w-full max-w-md bg-stitch-surface-container-lowest border border-stitch-outline-variant shadow-sm flex flex-col md:relative fixed bottom-0 md:bottom-auto left-0 md:left-auto max-h-[90vh]">
        
        <div className="p-6 pb-4 border-b border-stitch-outline-variant flex justify-between items-center bg-stitch-surface-container-lowest">
          <h2 className="font-display text-2xl font-bold tracking-tight text-stitch-on-surface uppercase">REPORT ATTENDANCE ISSUE</h2>
          <button onClick={onClose} className="text-stitch-secondary hover:text-stitch-on-surface transition-colors p-1" aria-label="Close">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          {errorMsg && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-600 text-sm font-sans dark:bg-red-900/30 dark:border-red-700/50 dark:text-red-300" role="alert">
              {errorMsg}
            </div>
          )}

          <div className="space-y-4">
            <p className="font-sans text-sm text-stitch-on-surface-variant">
              If you were present at this event but your attendance was not recorded, please provide the details below. Our team will review your submission.
            </p>
            <div className="space-y-2">
              <label htmlFor="dispute-reason" className="block font-mono text-xs font-bold tracking-widest text-stitch-on-surface uppercase">
                Reason *
              </label>
              <textarea
                id="dispute-reason"
                className="w-full min-h-[120px] p-3 font-sans text-sm border border-stitch-outline-variant focus:border-stitch-on-surface focus:ring-1 focus:ring-stitch-on-surface outline-none resize-y rounded-none bg-stitch-surface-container-lowest text-stitch-on-surface"
                placeholder="Explain why your attendance is missing..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={isPending}
              />
            </div>
          </div>
        </div>

        <div className="p-6 pt-4 border-t border-stitch-outline-variant flex flex-col sm:flex-row justify-end gap-3 bg-stitch-surface mt-auto">
          <button
            onClick={onClose}
            disabled={isPending}
            className="px-6 py-3 font-mono text-sm font-bold tracking-widest uppercase text-stitch-on-surface bg-transparent border border-stitch-outline-variant hover:bg-stitch-surface-variant transition-colors rounded-none disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isPending}
            aria-disabled={isPending}
            className="px-6 py-3 font-mono text-sm font-bold tracking-widest uppercase text-stitch-surface-container-lowest bg-stitch-on-surface hover:opacity-80 transition-colors rounded-none disabled:opacity-50 flex items-center justify-center min-w-[140px]"
          >
            {isPending ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-stitch-surface-container-lowest" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                SUBMITTING...
              </>
            ) : (
              'SUBMIT'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
