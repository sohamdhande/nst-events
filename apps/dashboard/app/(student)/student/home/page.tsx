'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useCurrentUser } from '../../../../hooks/useCurrentUser';
import { useMyRegistrations } from '../../../../hooks/useMyRegistrations';
import { useDashboardSummary } from '../../../../hooks/useDashboardSummary';
import { Skeleton } from '../../../../components/ui/Skeleton';
import { ErrorState } from '../../../../components/ui/ErrorState';
import { ArrowRight, MapPin, Clock, CalendarIcon } from 'lucide-react';

dayjs.extend(isBetween);
dayjs.extend(relativeTime);

export default function StudentHomePage() {
  const router = useRouter();
  const { data: user, isLoading: isUserLoading, isError: isUserError, refetch: refetchUser } = useCurrentUser();
  const { data: registrations, isLoading: isRegLoading, isError: isRegError, refetch: refetchReg } = useMyRegistrations();
  const { data: summary, isLoading: isSummaryLoading, isError: isSummaryError, refetch: refetchSummary } = useDashboardSummary();

  if (isUserLoading || isRegLoading || isSummaryLoading) {
    return (
      <div className="p-stitch-md md:p-stitch-xl max-w-[1440px] mx-auto w-full flex flex-col gap-10">
        <Skeleton className="h-20 w-64" />
        <Skeleton className="h-64 w-full rounded-none" />
      </div>
    );
  }

  if (isUserError || isRegError || isSummaryError) {
    return (
      <div className="p-stitch-md md:p-stitch-xl max-w-[1440px] mx-auto w-full">
        <ErrorState 
          title="Could not load your home page"
          message="We could not retrieve your latest schedule and statistics."
          action={<button className="border border-stitch-outline text-stitch-on-background stitch-text-label-mono uppercase px-stitch-lg py-stitch-md hover:bg-stitch-surface transition-colors" onClick={() => { refetchUser(); refetchReg(); refetchSummary(); }}>Retry</button>}
        />
      </div>
    );
  }

  const hour = dayjs().hour();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const rawFirstName = user?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'Student';
  const firstName = rawFirstName.charAt(0).toUpperCase() + rawFirstName.slice(1).toLowerCase();

  const now = dayjs();
  
  // 1. PRIORITY (Live Now)
  const liveRegistrations = (registrations || []).filter(reg => {
    if (reg.registrationStatus !== 'REGISTERED') return false;
    if (!reg.event?.startTime || !reg.event?.endTime) return false;
    try {
      const startTime = dayjs(reg.event.startTime);
      const endTime = dayjs(reg.event.endTime);
      const windowStart = startTime.subtract(15, 'minute');
      return now.isBetween(windowStart, endTime, null, '[]');
    } catch { return false; }
  });

  const activeEventReg = liveRegistrations.length > 0 ? liveRegistrations[0] : null;

  // 2. YOUR NEXT (Future)
  const upcomingRegistrations = (registrations || [])
    .filter(reg => {
      if (reg.registrationStatus !== 'REGISTERED' && reg.registrationStatus !== 'WAITLISTED') return false;
      if (activeEventReg && reg.id === activeEventReg.id) return false;
      if (!reg.event?.endTime) return false;
      return dayjs(reg.event.endTime).isAfter(now);
    })
    .sort((a, b) => dayjs(a.event?.startTime).valueOf() - dayjs(b.event?.startTime).valueOf());

  const nextEventReg = upcomingRegistrations.length > 0 ? upcomingRegistrations[0] : null;
  const remainingUpcoming = upcomingRegistrations.slice(1);

  return (
    <main className="flex-grow w-full px-stitch-margin-mobile md:px-stitch-margin-desktop pt-12 pb-16 bg-stitch-background min-h-screen">
      
      {/* Greeting & Progress */}
      <div className="mb-12 flex flex-col md:flex-row justify-between items-end border-b border-stitch-outline-variant pb-8">
        <div className="mb-stitch-lg md:mb-0">
          <h1 className="stitch-text-display-lg-mobile md:stitch-text-display-lg text-stitch-on-background">
            {greeting}, {firstName}.
          </h1>
          <p className="stitch-text-body-lg text-stitch-secondary mt-stitch-xs">
            Welcome back to campus.
          </p>
        </div>
        {summary && (
          <div className="flex gap-stitch-xl stitch-text-label-mono uppercase tracking-widest text-stitch-secondary">
            <div className="flex flex-col">
              <span className="text-stitch-on-background font-bold text-[24px] font-stitch-headline">{summary.eventsAttendedCount ?? 0}</span>
              <span>Events Attended</span>
            </div>
            <div className="flex flex-col">
              <span className="text-stitch-on-background font-bold text-[24px] font-stitch-headline">{summary.totalPoints ?? 0}</span>
              <span>Points Earned</span>
            </div>
          </div>
        )}
      </div>

      {/* State C: Empty */}
      {!activeEventReg && !nextEventReg && (
        <section className="mb-16 text-center py-16">
          <h2 className="stitch-text-headline-lg-mobile md:stitch-text-headline-lg text-stitch-on-background mb-stitch-md uppercase tracking-wide">Nothing Scheduled</h2>
          <p className="stitch-text-body-lg text-stitch-secondary max-w-md mx-auto mb-stitch-xl">
            You don't have anything coming up yet. Explore what's happening around campus.
          </p>
          <div className="flex justify-center">
            <button 
              onClick={() => router.push('/student/campus')}
              className="bg-stitch-primary text-stitch-on-primary stitch-text-label-mono uppercase tracking-widest px-stitch-xl py-stitch-md rounded-none hover:bg-stitch-surface-tint transition-colors inline-flex items-center gap-2"
            >
              Explore Events <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </section>
      )}

      {/* State A: Starting Soon (Priority) */}
      {activeEventReg && (
        <section className="mb-16">
          <p className="stitch-text-label-mono text-stitch-primary uppercase tracking-widest mb-stitch-md flex items-center gap-stitch-sm">
            <span className="w-[8px] h-[8px] bg-stitch-primary rounded-full animate-pulse"></span>
            Starting Soon
          </p>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-stitch-gutter items-center">
            <div className="order-2 md:order-1 col-span-12">
              <h2 className="stitch-text-display-lg-mobile md:stitch-text-display-lg text-stitch-on-background leading-none mb-stitch-lg">
                {activeEventReg.event?.title || 'Event'}
              </h2>
              <div className="flex flex-col sm:flex-row gap-stitch-lg items-start sm:items-center stitch-text-label-mono text-stitch-secondary mb-stitch-xl">
                <span className="flex items-center gap-stitch-xs">
                  <Clock className="w-4 h-4" /> 
                  {dayjs(activeEventReg.event?.startTime).format('h:mm A')} - {dayjs(activeEventReg.event?.endTime).format('h:mm A')}
                </span>
                {activeEventReg.event?.locationName && (
                  <span className="flex items-center gap-stitch-xs">
                    <MapPin className="w-4 h-4" /> 
                    {activeEventReg.event.locationName}
                  </span>
                )}
              </div>
              <div className="flex gap-4 flex-col sm:flex-row sm:items-center mt-2">
                <button 
                  onClick={() => router.push(`/student/events/${activeEventReg.eventId}`)}
                  className="bg-stitch-primary text-stitch-on-primary stitch-text-label-mono uppercase px-stitch-lg py-stitch-md rounded-none hover:bg-stitch-surface-tint cursor-pointer transition-colors w-full sm:w-auto"
                >
                  Event Details
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* State B: Upcoming (If no active event, next event gets more prominence) */}
      {!activeEventReg && nextEventReg && (
        <section className="mb-16">
          <div className="border-b border-stitch-outline-variant pb-12">
            <p className="stitch-text-label-mono text-stitch-secondary uppercase tracking-widest mb-stitch-md">Next Registered Event</p>
            <div className="max-w-4xl">
              <h2 className="stitch-text-display-lg-mobile md:stitch-text-display-lg text-stitch-on-background leading-tight mb-stitch-lg">
                {nextEventReg.event?.title || 'Event'}
              </h2>
              <div className="flex flex-col sm:flex-row gap-stitch-lg items-start sm:items-center stitch-text-label-mono text-stitch-secondary mb-stitch-xl">
                <span className="flex items-center gap-stitch-xs">
                  <CalendarIcon className="w-4 h-4" /> 
                  {dayjs(nextEventReg.event?.startTime).format('MMM D')} &middot; {dayjs(nextEventReg.event?.startTime).format('h:mm A')}
                </span>
                {nextEventReg.event?.locationName && (
                  <span className="flex items-center gap-stitch-xs">
                    <MapPin className="w-4 h-4" /> 
                    {nextEventReg.event.locationName}
                  </span>
                )}
                <span className="bg-stitch-surface-variant text-stitch-on-surface px-stitch-sm py-stitch-unit rounded-none uppercase">
                  {nextEventReg.registrationStatus}
                </span>
              </div>
              <div className="flex gap-stitch-md flex-col sm:flex-row">
                <button 
                  onClick={() => router.push(`/student/events/${nextEventReg.eventId}`)}
                  className="bg-stitch-primary text-stitch-on-primary stitch-text-label-mono uppercase px-stitch-lg py-stitch-md rounded-none hover:bg-stitch-surface-tint cursor-pointer transition-colors w-full sm:w-auto"
                >
                  Event Details
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Up Next Divider & List */}
      {(activeEventReg && nextEventReg) || (!activeEventReg && remainingUpcoming.length > 0) ? (
        <>
          <div className="w-full border-t border-stitch-outline-variant pt-8 mb-6 flex justify-between items-center mt-12">
            <h3 className="stitch-text-headline-lg text-stitch-on-background">Up Next</h3>
            <Link href="/student/campus" className="stitch-text-label-mono text-stitch-primary uppercase hover:underline flex items-center gap-stitch-xs group">
              Explore Campus
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
          
          <section className="flex flex-col">
            {(activeEventReg ? upcomingRegistrations : remainingUpcoming).map(reg => (
              <Link 
                key={reg.id}
                href={`/student/events/${reg.eventId}`}
                className="group border-b border-stitch-outline-variant py-5 flex flex-col md:flex-row justify-between md:items-center gap-4 hover:bg-stitch-surface transition-colors"
              >
                <div className="flex-grow">
                  <p className="stitch-text-label-mono text-stitch-secondary mb-stitch-xs">
                    {dayjs(reg.event?.startTime).format('MMM D &middot; h:mm A')}
                  </p>
                  <h4 className="stitch-text-headline-lg-mobile md:stitch-text-headline-lg text-stitch-on-background group-hover:text-stitch-primary transition-colors">
                    {reg.event?.title || 'Unknown Event'}
                  </h4>
                  {reg.event?.locationName && (
                    <p className="stitch-text-body-md text-stitch-secondary mt-stitch-xs">
                      {reg.event.locationName}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-stitch-md mt-stitch-md md:mt-0">
                  <span className="bg-stitch-surface-variant text-stitch-on-surface stitch-text-label-mono uppercase px-stitch-sm py-stitch-unit rounded-none">
                    {reg.registrationStatus}
                  </span>
                  <ArrowRight className="w-5 h-5 text-stitch-secondary group-hover:text-stitch-primary transition-colors hidden md:block" />
                </div>
              </Link>
            ))}
          </section>
        </>
      ) : null}

    </main>
  );
}
