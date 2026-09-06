'use client';

import React, { useEffect } from 'react';
import { useClubAdmin } from '../../../../../components/layout/ClubAdminProvider';
import { useEvents } from '../../../../../hooks/useEvents';
import { Plus, Calendar as CalendarIcon, MapPin, Users, Settings } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import clsx from 'clsx';

const dateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

export default function ClubEventsPage() {
  const { activeClubId, isHydrated } = useClubAdmin();
  const router = useRouter();

  useEffect(() => {
    if (isHydrated && !activeClubId) {
      router.push('/student/home');
    }
  }, [isHydrated, activeClubId, router]);

  const { data: eventsData, isLoading } = useEvents({ filter_club_id: activeClubId || undefined, limit: 100 });

  if (!isHydrated || isLoading) {
    return (
      <div className="w-full flex-grow flex justify-center items-center h-64">
        <div className="animate-pulse flex flex-col items-center">
          <div className="h-8 w-8 border-4 border-stitch-on-surface border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-sm font-medium text-stitch-secondary uppercase tracking-widest font-mono">Loading Events...</p>
        </div>
      </div>
    );
  }

  const events = eventsData?.data || [];

  return (
    <div className="w-full max-w-[1440px] mx-auto px-6 py-6 md:px-12 md:py-8 lg:px-16">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <div className="text-[11px] font-mono font-bold tracking-widest uppercase mb-1 text-stitch-secondary">
            CLUB MANAGEMENT
          </div>
          <h1 className="text-3xl md:text-4xl lg:text-[44px] font-black text-stitch-on-surface tracking-tight leading-tight uppercase" style={{ fontFamily: 'Syne, sans-serif' }}>
            Events
          </h1>
        </div>
        <Link 
          href="/student/manage/events/create"
          className="flex items-center gap-2 px-6 py-3 bg-stitch-primary text-stitch-on-primary font-mono font-bold text-xs tracking-widest hover:opacity-80 transition-opacity uppercase"
        >
          <Plus className="w-4 h-4" />
          Create Event
        </Link>
      </div>

      {events.length === 0 ? (
        <div className="w-full p-12 border border-stitch-outline-variant bg-stitch-surface-container-lowest flex flex-col items-center justify-center text-center">
          <CalendarIcon className="w-12 h-12 text-stitch-secondary mb-4 opacity-50" />
          <h3 className="text-sm font-mono font-bold text-stitch-on-surface uppercase tracking-widest mb-2">No Events Yet</h3>
          <p className="text-sm text-stitch-secondary mb-6 max-w-md">Get started by creating your first event. Once created, you can manage registrations, teams, and attendance.</p>
          <Link 
            href="/student/manage/events/create"
            className="px-6 py-3 border border-stitch-primary text-stitch-primary font-mono font-bold text-xs tracking-widest hover:bg-stitch-primary hover:text-stitch-on-primary transition-colors uppercase"
          >
            Create Your First Event
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {events.map((event) => (
            <div key={event.id} className="border border-stitch-outline-variant bg-stitch-surface-container-lowest flex flex-col group">
              <div className="p-5 flex-grow">
                <div className="flex items-center justify-between mb-3">
                  <span className={clsx(
                    "text-[10px] font-mono font-bold tracking-[0.2em] uppercase",
                    event.state === 'PUBLISHED' ? "text-green-600 dark:text-green-400" :
                    event.state === 'DRAFT' ? "text-yellow-600 dark:text-yellow-400" :
                    "text-stitch-secondary"
                  )}>
                    {event.state}
                  </span>
                  {event.registrationType === 'TEAM' && (
                    <span className="text-[10px] font-mono tracking-widest uppercase bg-stitch-surface-variant px-2 py-0.5 border border-stitch-outline-variant text-stitch-secondary">
                      TEAM
                    </span>
                  )}
                </div>
                
                <h3 className="text-lg font-bold text-stitch-on-surface leading-tight mb-2 group-hover:text-stitch-primary transition-colors">
                  {event.title}
                </h3>
                
                <div className="space-y-2 mt-4">
                  <div className="flex items-start gap-2.5">
                    <CalendarIcon className="w-3.5 h-3.5 text-stitch-secondary mt-0.5" />
                    <span className="text-xs text-stitch-on-surface-variant">{dateFormatter.format(new Date(event.startTime))}</span>
                  </div>
                  {event.locationName && (
                    <div className="flex items-start gap-2.5">
                      <MapPin className="w-3.5 h-3.5 text-stitch-secondary mt-0.5" />
                      <span className="text-xs text-stitch-on-surface-variant truncate">{event.locationName}</span>
                    </div>
                  )}
                  <div className="flex items-start gap-2.5">
                    <Users className="w-3.5 h-3.5 text-stitch-secondary mt-0.5" />
                    <span className="text-xs text-stitch-on-surface-variant">
                      {event.registrationCount} {event.maxCapacity ? `/ ${event.maxCapacity}` : ''} registered
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="border-t border-stitch-outline-variant flex grid-cols-2">
                <Link 
                  href={`/student/events/${event.id}`}
                  className="w-1/2 flex items-center justify-center gap-2 py-3 text-[10px] font-mono font-bold uppercase tracking-widest text-stitch-secondary hover:bg-stitch-surface hover:text-stitch-on-surface transition-colors border-r border-stitch-outline-variant"
                >
                  View
                </Link>
                <Link 
                  href={`/student/events/${event.id}/manage`}
                  className="w-1/2 flex items-center justify-center gap-2 py-3 text-[10px] font-mono font-bold uppercase tracking-widest text-stitch-primary hover:bg-stitch-surface hover:text-stitch-on-surface transition-colors"
                >
                  <Settings className="w-3 h-3" />
                  Manage
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
