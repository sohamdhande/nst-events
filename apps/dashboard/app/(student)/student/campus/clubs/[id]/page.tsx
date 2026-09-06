'use client';

import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import dayjs from 'dayjs';
import clsx from 'clsx';
import { useClubDetail, ClubMember } from '../../../../../../hooks/useClubDetail';
import { useEvents } from '../../../../../../hooks/useEvents';
import { useCurrentUser } from '../../../../../../hooks/useCurrentUser';

export default function ClubDetailPage() {
  const params = useParams();
  const router = useRouter();
  const clubId = params.id as string;

  const { data: club, isLoading: isClubLoading, isError: isClubError } = useClubDetail(clubId);
  
  const { data: eventsData, isLoading: isEventsLoading } = useEvents({
    filter_club_id: clubId,
    limit: 50,
  });

  const { data: currentUser } = useCurrentUser();
  const isClubAdmin = currentUser?.club_memberships?.some(
    (m) => m.club_id === clubId && m.role === 'CLUB_ADMIN'
  );

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US', {
      notation: "compact",
      compactDisplay: "short"
    }).format(num);
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'CLUB_ADMIN': return 'Admin';
      case 'CORE_MEMBER': return 'Core';
      case 'FACULTY_MENTOR': return 'Mentor';
      case 'MEMBER': return 'Member';
      default: return role;
    }
  };

  if (isClubLoading) {
    return (
      <div className="w-full bg-stitch-background min-h-screen pb-stitch-xxl">
        <div className="w-full h-48 md:h-64 bg-stitch-surface-variant animate-pulse" />
        <div className="px-stitch-margin-mobile md:px-stitch-margin-desktop mt-stitch-xl max-w-[1440px] mx-auto grid grid-cols-1 md:grid-cols-12 gap-stitch-xl">
          <div className="md:col-span-8">
            <div className="h-12 bg-stitch-surface-variant w-1/2 mb-4 animate-pulse"></div>
            <div className="h-6 bg-stitch-surface-variant w-full mb-2 animate-pulse"></div>
            <div className="h-6 bg-stitch-surface-variant w-3/4 animate-pulse"></div>
          </div>
        </div>
      </div>
    );
  }

  if (isClubError || !club) {
    return (
      <div className="w-full px-stitch-margin-mobile md:px-stitch-margin-desktop py-stitch-xxl flex flex-col items-center justify-center text-center max-w-lg mx-auto min-h-screen">
        <h3 className="stitch-text-headline-lg text-stitch-on-background mb-stitch-sm">Club not found</h3>
        <p className="stitch-text-body-lg text-stitch-secondary mb-stitch-xl">This club may have been removed or you don&apos;t have access.</p>
        <button 
          onClick={() => router.push('/student/campus/clubs')} 
          className="border border-stitch-outline text-stitch-on-background stitch-text-label-mono uppercase tracking-widest px-stitch-lg py-stitch-md hover:bg-stitch-surface transition-colors"
        >
          Back to Directory
        </button>
      </div>
    );
  }

  const events = eventsData?.data || [];

  return (
    <div className="w-full bg-stitch-background min-h-screen pb-stitch-xxl">
      
      {/* Banner */}
      <div className="relative w-full h-48 md:h-64 bg-stitch-surface-variant overflow-hidden">
        {club.banner_url && (
          <img 
            src={club.banner_url} 
            alt={`${club.name} banner`} 
            className="w-full h-full object-cover"
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
        )}
        
        {/* Navigation Overlay */}
        <div className="absolute top-stitch-lg left-stitch-margin-mobile md:left-stitch-margin-desktop z-10">
          <Link 
            href="/student/campus/clubs"
            className="inline-flex items-center gap-2 stitch-text-label-mono uppercase tracking-widest text-stitch-on-background bg-stitch-background/90 px-4 py-2 hover:bg-stitch-background transition-colors"
          >
            &larr; Back to Clubs
          </Link>
        </div>
      </div>

      <div className="px-stitch-margin-mobile md:px-stitch-margin-desktop mt-stitch-xl max-w-[1440px] mx-auto">
        <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:justify-between lg:gap-16">
          
          {/* Main Info */}
          <div className="flex-1 max-w-3xl">
            <h1 className="stitch-text-display-lg-mobile md:stitch-text-display-lg text-stitch-on-background mb-stitch-sm tracking-tight break-words">
              {club.name}
            </h1>
            <p className="stitch-text-body-lg text-stitch-secondary whitespace-pre-wrap leading-relaxed">
              {club.description || 'No description provided.'}
            </p>
          </div>
          
          {/* Metadata Block */}
          <div className="flex items-center gap-12 pt-4 lg:pt-0 shrink-0">
            <div>
              <div className="stitch-text-headline-lg text-stitch-on-background leading-none mb-1">
                {formatNumber(club.members?.length || 0)}
              </div>
              <div className="stitch-text-label-mono text-stitch-secondary uppercase tracking-widest">
                Members
              </div>
            </div>
            <div>
              <div className="stitch-text-headline-lg text-stitch-on-background leading-none mb-1">
                {formatNumber(club.event_count)}
              </div>
              <div className="stitch-text-label-mono text-stitch-secondary uppercase tracking-widest">
                Events
              </div>
            </div>
          </div>
        </div>

        <div className="h-px w-full bg-stitch-on-background my-stitch-xl"></div>

        {isClubAdmin && (
          <div className="mb-stitch-xl p-4 border border-stitch-outline-variant bg-stitch-surface-container-lowest">
            <h2 className="text-xs font-mono font-bold tracking-[0.2em] text-stitch-primary uppercase mb-2">
              Club Operations
            </h2>
            <div className="text-xs font-mono text-stitch-secondary">
              Administrative controls are currently being integrated. Event creation and roster management will appear here.
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-stitch-xxl">
          
          {/* Left Column: Members */}
          <div className="lg:col-span-4 lg:pr-8">
            <h2 className="stitch-text-label-mono text-stitch-secondary uppercase tracking-widest mb-stitch-md border-b border-stitch-outline-variant pb-2">
              Roster
            </h2>
            
            {club.members && club.members.length > 0 ? (
              <div className="flex flex-col">
                {club.members.map((member: ClubMember) => (
                  <div key={member.user_id} className="py-stitch-sm border-b border-stitch-outline-variant flex items-center justify-between gap-4">
                    <div className="stitch-text-body-lg text-stitch-on-background truncate">
                      {member.full_name}
                    </div>
                    <div className={clsx(
                      "font-stitch-label text-[10px] md:text-[11px] uppercase tracking-widest shrink-0",
                      ['CLUB_ADMIN', 'CORE_MEMBER', 'FACULTY_MENTOR'].includes(member.role) 
                        ? 'text-stitch-primary/80' 
                        : 'text-stitch-secondary/60'
                    )}>
                      {getRoleLabel(member.role)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-stitch-md text-stitch-secondary stitch-text-body-lg">
                No public roster.
              </div>
            )}
          </div>

          {/* Right Column: Events */}
          <div className="lg:col-span-8">
            <h2 className="stitch-text-label-mono text-stitch-secondary uppercase tracking-widest mb-stitch-md border-b border-stitch-outline-variant pb-2">
              Upcoming Events
            </h2>
            
            {isEventsLoading ? (
               <div className="animate-pulse space-y-4">
                 <div className="h-24 bg-stitch-surface-variant w-full border-b border-stitch-outline-variant"></div>
                 <div className="h-24 bg-stitch-surface-variant w-full border-b border-stitch-outline-variant"></div>
               </div>
            ) : events.length === 0 ? (
              <div className="py-stitch-md text-stitch-secondary stitch-text-body-lg">
                No events currently scheduled.
              </div>
            ) : (
              <div className="flex flex-col">
                {events.map(event => {
                  const date = dayjs(event.startTime);
                  const dateLabel = date.format('ddd, MMM D');
                  const locationLabel = event.locationName || 'Campus';
                  
                  return (
                    <Link 
                      key={event.id} 
                      href={`/student/events/${event.id}`} 
                      className="group block py-stitch-md border-b border-stitch-outline-variant transition-colors"
                    >
                      <h3 className="stitch-text-headline-lg text-stitch-on-background mb-stitch-xs line-clamp-1 group-hover:text-stitch-primary transition-colors leading-tight">
                        {event.title}
                      </h3>
                      <div className="stitch-text-label-mono text-stitch-secondary uppercase tracking-widest flex items-center flex-wrap gap-2 opacity-90 mt-3">
                        <span>{dateLabel}</span>
                        <span className="text-stitch-outline-variant">|</span>
                        <span>{date.format('h:mm A')}</span>
                        <span className="text-stitch-outline-variant">|</span>
                        <span>{locationLabel}</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
