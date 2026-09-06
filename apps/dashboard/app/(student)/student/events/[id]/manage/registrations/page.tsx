'use client';

import React, { use, useState } from 'react';
import { useRegistrationsList } from '../../../../../../../hooks/useRegistrations';
import { useEventDetail } from '../../../../../../../hooks/useEventDetail';
import clsx from 'clsx';
import { Search } from 'lucide-react';

export default function ManageRegistrationsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: eventId } = use(params);
  const { data: event, isLoading: isLoadingEvent } = useEventDetail(eventId);
  
  const [filterStatus, setFilterStatus] = useState<string>('');

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useRegistrationsList(
    eventId, 
    filterStatus || undefined
  );

  const registrations = data?.pages.flatMap(p => p.data) || [];

  if (isLoadingEvent || isLoading) {
    return (
      <div className="w-full h-32 flex items-center justify-center border border-stitch-outline-variant bg-stitch-surface">
        <div className="animate-pulse flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-stitch-on-surface border-t-transparent rounded-full animate-spin"></div>
          <span className="text-[10px] font-mono uppercase tracking-widest text-stitch-secondary">Loading Registrations...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        
        <div className="flex bg-stitch-surface-container-lowest border border-stitch-outline-variant w-full sm:w-64 relative">
          <Search className="w-4 h-4 text-stitch-secondary absolute left-3 top-1/2 transform -translate-y-1/2" />
          <input 
            type="text" 
            placeholder="Search by name or email..."
            className="w-full bg-transparent pl-9 pr-3 py-2 text-sm font-sans text-stitch-on-surface focus:outline-none focus:border-stitch-primary"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-[10px] font-mono uppercase tracking-widest text-stitch-secondary hidden sm:inline">Status:</span>
          <select 
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-stitch-surface-container-lowest border border-stitch-outline-variant px-3 py-2 text-xs font-mono uppercase tracking-widest text-stitch-on-surface focus:outline-none w-full sm:w-auto"
          >
            <option value="">All Registrations</option>
            <option value="REGISTERED">Registered</option>
            <option value="WAITLISTED">Waitlisted</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>

      </div>

      {/* Table Area */}
      <div className="overflow-x-auto border border-stitch-outline-variant bg-stitch-surface-container-lowest">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-stitch-outline-variant bg-stitch-surface">
              <th className="px-4 py-3 text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-stitch-secondary">User</th>
              <th className="px-4 py-3 text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-stitch-secondary">Status</th>
              <th className="px-4 py-3 text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-stitch-secondary">Date</th>
            </tr>
          </thead>
          <tbody>
            {registrations.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-12 text-center text-stitch-secondary text-sm font-mono uppercase tracking-widest">
                  No registrations found.
                </td>
              </tr>
            ) : (
              registrations.map((reg) => (
                <tr key={reg.id} className="border-b border-stitch-outline-variant last:border-b-0 hover:bg-stitch-surface transition-colors">
                  <td className="px-4 py-4">
                    <div className="text-sm font-semibold text-stitch-on-surface">
                      {reg.user.fullName || 'Unknown User'}
                    </div>
                    <div className="text-xs text-stitch-secondary">
                      {reg.user.email}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <span className={clsx(
                      "text-[10px] font-mono font-bold tracking-widest uppercase px-2 py-0.5 border",
                      reg.registrationStatus === 'REGISTERED' ? "border-green-600 text-green-600 bg-green-50 dark:bg-green-900/10 dark:text-green-400 dark:border-green-400" :
                      reg.registrationStatus === 'WAITLISTED' ? "border-yellow-600 text-yellow-600 bg-yellow-50 dark:bg-yellow-900/10 dark:text-yellow-400 dark:border-yellow-400" :
                      "border-stitch-outline-variant text-stitch-secondary bg-stitch-surface"
                    )}>
                      {reg.registrationStatus}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-xs font-mono text-stitch-on-surface-variant tabular-nums">
                    {new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(reg.registeredAt))}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {hasNextPage && (
        <div className="flex justify-center mt-6">
          <button
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            className="px-6 py-2 border border-stitch-outline-variant text-stitch-secondary font-mono text-xs uppercase tracking-widest hover:text-stitch-on-surface hover:bg-stitch-surface transition-colors disabled:opacity-50"
          >
            {isFetchingNextPage ? 'Loading more...' : 'Load More'}
          </button>
        </div>
      )}
      
    </div>
  );
}
