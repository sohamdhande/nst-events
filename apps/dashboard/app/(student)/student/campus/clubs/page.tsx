'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useClubs } from '../../../../../hooks/useClubs';
import { useDebounce } from '../../../../../hooks/useDebounce';

export default function CampusClubsPage() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch] = useDebounce(searchTerm, 300);

  const { data: clubsResponse, isLoading, isError, refetch } = useClubs(debouncedSearch);

  const formatNumber = (num: number) => {
    if (num >= 1000) {
      return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    }
    return new Intl.NumberFormat('en-US').format(num);
  };

  const renderLoadingState = () => {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-stitch-xl gap-y-stitch-xl w-full">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="animate-pulse border-b border-stitch-outline-variant pb-stitch-lg">
            <div className="h-32 md:h-40 bg-stitch-surface-variant w-full mb-4"></div>
            <div className="flex justify-between items-start mb-4">
              <div className="h-8 bg-stitch-surface-variant w-2/3"></div>
              <div className="h-4 bg-stitch-surface-variant w-16 mt-2"></div>
            </div>
            <div className="h-4 bg-stitch-surface-variant w-full mb-2"></div>
            <div className="h-4 bg-stitch-surface-variant w-4/5"></div>
          </div>
        ))}
      </div>
    );
  };

  const renderEmptyState = () => {
    return (
      <div className="py-stitch-xxl flex flex-col items-center justify-center text-center max-w-lg mx-auto">
        <h3 className="stitch-text-headline-lg text-stitch-on-background mb-stitch-sm">No clubs found</h3>
        <p className="stitch-text-body-lg text-stitch-secondary mb-stitch-xl">Try adjusting your search terms.</p>
      </div>
    );
  };

  const renderErrorState = () => {
    return (
      <div className="py-stitch-xxl flex flex-col items-center justify-center text-center max-w-lg mx-auto">
        <h3 className="stitch-text-headline-lg text-stitch-on-background mb-stitch-sm">Couldn&apos;t load clubs</h3>
        <p className="stitch-text-body-lg text-stitch-secondary mb-stitch-xl">Something went wrong while connecting to the server.</p>
        <button onClick={() => refetch()} className="bg-stitch-primary text-stitch-on-primary stitch-text-label-mono uppercase tracking-widest px-stitch-lg py-stitch-md hover:bg-stitch-surface-tint transition-colors">Retry</button>
      </div>
    );
  };

  return (
    <div className="w-full px-stitch-margin-mobile md:px-stitch-margin-desktop pt-stitch-xl pb-stitch-xxl bg-stitch-background min-h-screen">
      
      {/* Header section */}
      <section className="mb-stitch-sm">
        <h1 className="stitch-text-display-lg-mobile md:stitch-text-display-lg text-stitch-on-background uppercase mb-stitch-xs tracking-tight">
          Clubs
        </h1>
        <p className="stitch-text-body-lg text-stitch-secondary max-w-2xl">
          Discover the diverse communities shaping our campus. Connect, collaborate, and create with peers who share your passions.
        </p>
      </section>

      {/* Search Input Row */}
      <section className="mb-stitch-sm">
        <div className="flex items-center gap-3 w-full border-b border-stitch-outline-variant focus-within:border-stitch-primary transition-colors pb-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-stitch-secondary shrink-0">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input
            type="text"
            placeholder="Search clubs by name or keywords..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-transparent border-none outline-none text-stitch-on-background stitch-text-body-md placeholder:text-stitch-secondary placeholder:font-normal focus:ring-0 rounded-none px-0"
          />
        </div>
      </section>

      {/* Content */}
      <div className="animate-in fade-in duration-300">
        {isLoading ? (
          renderLoadingState()
        ) : isError ? (
          renderErrorState()
        ) : clubsResponse?.data.length === 0 ? (
          renderEmptyState()
        ) : (
          <div className="flex flex-col gap-4">
            <div className="stitch-text-label-mono text-stitch-secondary tracking-widest uppercase mb-2">
              {clubsResponse?.data.length} {clubsResponse?.data.length === 1 ? 'Result' : 'Results'}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-stitch-xl gap-y-stitch-xl w-full">
            {clubsResponse?.data.map((club) => (
              <div 
                key={club.id} 
                className="group cursor-pointer flex flex-col border-b border-stitch-outline-variant pb-stitch-lg transition-colors hover:bg-stitch-surface-variant/30 px-4 -mx-4 pt-4 -mt-4 rounded-none"
                onClick={() => router.push(`/student/campus/clubs/${club.id}`)}
              >
                <div className="w-full h-24 md:h-28 mb-4 bg-stitch-surface-variant/30 overflow-hidden shrink-0 relative rounded-none border border-stitch-outline-variant">
                  {club.banner_url && (
                    <img 
                      src={club.banner_url} 
                      alt={`${club.name} banner`} 
                      className="w-full h-full object-cover absolute inset-0 z-10"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  )}
                </div>
                
                <div className="flex justify-between items-start gap-4 mb-3">
                  <h3 className="font-stitch-headline text-xl md:text-2xl font-bold leading-tight break-words text-stitch-on-background group-hover:text-stitch-primary transition-colors line-clamp-2">
                    {club.name}
                  </h3>
                  <div className="flex-shrink-0 pt-1 stitch-text-label-mono text-stitch-secondary uppercase tracking-widest text-right whitespace-nowrap">
                    <span className="mr-1">{formatNumber(club.member_count)}</span> 
                    <span className="hidden sm:inline">MEMBERS</span>
                  </div>
                </div>
                
                <p className="stitch-text-body-lg text-stitch-secondary line-clamp-2 pr-8">
                  {club.description || 'No description provided.'}
                </p>
              </div>
            ))}
          </div>
        </div>
        )}
      </div>

    </div>
  );
}
