'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
import { useEvents } from '../../../../../hooks/useEvents';
import clsx from 'clsx';

dayjs.extend(isBetween);

const EVENT_TYPES = [
  { label: 'All', value: '' },
  { label: 'Workshops', value: 'WORKSHOP' },
  { label: 'Seminars', value: 'SEMINAR' },
  { label: 'Competitions', value: 'COMPETITION' },
  { label: 'Meetups', value: 'MEETUP' },
  { label: 'Hackathons', value: 'HACKATHON' },
  { label: 'Cultural', value: 'CULTURAL' },
  { label: 'Sports', value: 'SPORTS' },
  { label: 'Other', value: 'OTHER' },
];

export default function DiscoverPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  
  const queryQ = searchParams.get('q') || '';
  const queryType = searchParams.get('type') || '';

  const [searchInput, setSearchInput] = useState(queryQ);

  // Debounce search input to URL
  useEffect(() => {
    const handler = setTimeout(() => {
      const newParams = new URLSearchParams(searchParams.toString());
      if (searchInput.trim()) {
        newParams.set('q', searchInput);
      } else {
        newParams.delete('q');
      }
      
      // Avoid replacing if nothing changed
      if (searchParams.get('q') !== (searchInput || null)) {
        router.replace(`${pathname}?${newParams.toString()}`);
      }
    }, 300);

    return () => clearTimeout(handler);
  }, [searchInput, pathname, router, searchParams]);

  // Fetch events
  const { data: eventsData, isLoading, isError, refetch } = useEvents({
    q: queryQ || undefined,
    filter_state: 'PUBLISHED',
    filter_event_type: queryType || undefined,
    limit: 50 // Loading more to simulate pagination for now
  });

  
  const handleTypeClick = useCallback((typeVal: string) => {
    const newParams = new URLSearchParams(searchParams.toString());
    if (typeVal) {
      newParams.set('type', typeVal);
    } else {
      newParams.delete('type');
    }
    router.push(`${pathname}?${newParams.toString()}`);
  }, [pathname, router, searchParams]);

  const renderEmptyState = () => {
    if (isError) {
      return (
        <div className="py-stitch-xxl flex flex-col items-center justify-center text-center max-w-lg mx-auto">
          <h3 className="stitch-text-headline-lg text-stitch-on-background mb-stitch-sm">Couldn&apos;t load events</h3>
          <p className="stitch-text-body-lg text-stitch-secondary mb-stitch-xl">Something went wrong while connecting to the server.</p>
          <button onClick={() => refetch()} className="bg-stitch-primary text-stitch-on-primary stitch-text-label-mono uppercase tracking-widest px-stitch-lg py-stitch-md hover:bg-stitch-surface-tint transition-colors">Retry</button>
        </div>
      );
    }
    if (isLoading) {
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-stitch-xl gap-y-stitch-lg">
          {[1,2,3,4,5,6].map(i => (
            <div key={i} className="border-b border-stitch-outline-variant pb-stitch-md animate-pulse">
              <div className="h-8 bg-stitch-surface-variant w-3/4 mb-4"></div>
              <div className="h-4 bg-stitch-surface-variant w-1/2"></div>
            </div>
          ))}
        </div>
      );
    }
    if (!eventsData?.data || eventsData.data.length === 0) {
      return (
        <div className="py-stitch-xxl flex flex-col items-center justify-center text-center max-w-lg mx-auto">
          <h3 className="stitch-text-headline-lg text-stitch-on-background mb-stitch-sm">No events found</h3>
          <p className="stitch-text-body-lg text-stitch-secondary mb-stitch-xl">Try a different search or clear your filters to explore more.</p>
          <button 
            onClick={() => { setSearchInput(''); router.push(pathname); }}
            className="border border-stitch-outline text-stitch-on-background stitch-text-label-mono uppercase tracking-widest px-stitch-lg py-stitch-md hover:bg-stitch-surface transition-colors"
          >
            Clear Filters
          </button>
        </div>
      );
    }
    return null;
  };

  const events = eventsData?.data || [];

  return (
    <div className="w-full px-stitch-margin-mobile md:px-stitch-margin-desktop pt-stitch-xl pb-stitch-xxl bg-stitch-background min-h-screen">
      
      {/* Header section */}
      <section className="mb-stitch-xxl text-center">
        <h1 className="stitch-text-display-lg-mobile md:stitch-text-display-lg text-stitch-on-background uppercase mb-stitch-xs tracking-tight">
          Discover
        </h1>
        <p className="stitch-text-body-lg text-stitch-secondary">
          Find your next moment. Explore premium events across campus.
        </p>
      </section>

      {/* Search Input */}
      <section className="mb-stitch-lg">
        <input
          type="text"
          className="w-full px-0 bg-transparent border-0 border-b border-stitch-outline-variant focus:border-stitch-primary focus:ring-0 text-stitch-on-background stitch-text-body-lg md:text-[24px] pb-stitch-md placeholder:text-stitch-secondary placeholder:font-light outline-none transition-colors rounded-none"
          placeholder="Search events, clubs, topics..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
      </section>

      {/* Filters Row */}
      <section className="flex items-center gap-stitch-lg overflow-x-auto no-scrollbar pb-stitch-xs">
        {EVENT_TYPES.map(type => {
          const isActive = queryType === type.value;
          return (
            <button
              key={type.label}
              onClick={() => handleTypeClick(type.value)}
              className={clsx(
                "stitch-text-label-mono uppercase tracking-widest pb-2 transition-colors whitespace-nowrap",
                isActive 
                  ? "text-stitch-on-background border-b-2 border-stitch-on-background font-bold" 
                  : "text-stitch-secondary hover:text-stitch-on-background"
              )}
            >
              {type.label}
            </button>
          );
        })}
      </section>

      {/* Thick Separator */}
      <div className="h-[2px] bg-stitch-on-background w-full mb-stitch-xl"></div>

      {/* Result Meta */}
      <div className="flex justify-between items-center mb-stitch-lg stitch-text-label-mono text-stitch-secondary uppercase tracking-widest">
        <div>
          {!isLoading && events.length > 0 && `${events.length} results`}
        </div>
        {!isLoading && events.length > 0 && (
          <button className="hover:text-stitch-on-background transition-colors">
            Sort &darr;
          </button>
        )}
      </div>

      {/* Event Grid */}
      {!isLoading && events.length > 0 ? (
        <section className="grid grid-cols-1 md:grid-cols-2 gap-x-stitch-xl gap-y-stitch-xl">
          {events.map((event) => {
            const date = dayjs(event.startTime);
            const dateLabel = date.format('ddd, MMM D');
            const typeLabel = event.eventType ? event.eventType.charAt(0).toUpperCase() + event.eventType.slice(1).toLowerCase() : 'Event';
            const locationLabel = event.locationName || 'Campus';

            return (
              <Link 
                key={event.id} 
                href={`/student/events/${event.id}`} 
                className="group block border-b border-stitch-outline-variant pb-stitch-md transition-colors"
              >
                <h3 className="stitch-text-headline-lg text-stitch-on-background mb-stitch-xs line-clamp-2 group-hover:text-stitch-primary transition-colors leading-tight">
                  {event.title}
                </h3>
                <div className="stitch-text-label-mono text-stitch-secondary uppercase tracking-widest flex items-center flex-wrap gap-2 opacity-90 mt-stitch-sm">
                  <span>{dateLabel}</span>
                  <span className="text-stitch-outline-variant">|</span>
                  <span>{date.format('h:mm A')}</span>
                  <span className="text-stitch-outline-variant">|</span>
                  <span>{locationLabel}</span>
                  <span className="text-stitch-outline-variant">|</span>
                  <span>{typeLabel}</span>
                </div>
              </Link>
            );
          })}
        </section>
      ) : (
        renderEmptyState()
      )}
      
      {!isLoading && eventsData?.pagination?.has_more && (
        <div className="flex justify-center pt-stitch-xl pb-stitch-xxl">
          <button className="border border-stitch-outline text-stitch-on-background stitch-text-label-mono uppercase tracking-widest px-stitch-lg py-stitch-md hover:bg-stitch-surface transition-colors">
            Load More
          </button>
        </div>
      )}
    </div>
  );
}
