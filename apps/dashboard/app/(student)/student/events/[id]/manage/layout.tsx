'use client';

import React, { useEffect, use } from 'react';
import { useClubAdmin } from '../../../../../../components/layout/ClubAdminProvider';
import { useRouter, usePathname } from 'next/navigation';
import { useEventDetail } from '../../../../../../hooks/useEventDetail';
import Link from 'next/link';
import clsx from 'clsx';
import { ArrowLeft, LayoutDashboard, Users, UserCheck, ShieldAlert } from 'lucide-react';

export default function EventManageLayout({ children, params }: { children: React.ReactNode, params: Promise<{ id: string }> }) {
  const { id: eventId } = use(params);
  const { isClubAdminMode, isHydrated } = useClubAdmin();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // If not in admin mode, kick out
    if (isHydrated && !isClubAdminMode) {
      router.push(`/student/events/${eventId}`);
    }
  }, [isHydrated, isClubAdminMode, eventId, router]);

  const { data: event, isLoading } = useEventDetail(eventId);

  const tabs = [
    { name: 'Overview', path: `/student/events/${eventId}/manage`, icon: LayoutDashboard },
    { name: 'Registrations', path: `/student/events/${eventId}/manage/registrations`, icon: Users },
    { name: 'Teams', path: `/student/events/${eventId}/manage/teams`, icon: ShieldAlert, show: event?.registrationType === 'TEAM' },
    { name: 'Attendance', path: `/student/events/${eventId}/manage/attendance`, icon: UserCheck }
  ];

  if (!isHydrated || isLoading) {
    return (
      <div className="w-full flex-grow flex justify-center items-center h-64">
        <div className="animate-pulse flex flex-col items-center">
          <div className="h-8 w-8 border-4 border-stitch-on-surface border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-sm font-medium text-stitch-secondary uppercase tracking-widest font-mono">Loading Event...</p>
        </div>
      </div>
    );
  }

  if (!event) return null;

  return (
    <div className="w-full max-w-[1440px] mx-auto px-6 py-6 md:px-12 md:py-8 lg:px-16">
      
      <Link 
        href={`/student/events/${eventId}`}
        className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-widest text-stitch-on-surface hover:text-stitch-secondary transition-colors mb-6"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Event
      </Link>

      <div className="mb-8">
        <div className="text-[11px] font-mono font-bold tracking-widest uppercase mb-1 text-stitch-secondary flex items-center gap-2">
          EVENT MANAGEMENT
          <span className={clsx(
            "px-2 py-0.5 border text-[10px]",
            event.state === 'PUBLISHED' ? "border-green-600 text-green-600 dark:border-green-400 dark:text-green-400" :
            event.state === 'DRAFT' ? "border-yellow-600 text-yellow-600 dark:border-yellow-400 dark:text-yellow-400" :
            "border-stitch-outline-variant text-stitch-secondary"
          )}>
            {event.state}
          </span>
        </div>
        <h1 className="text-3xl md:text-4xl font-black text-stitch-on-surface tracking-tight leading-tight uppercase" style={{ fontFamily: 'Syne, sans-serif' }}>
          {event.title}
        </h1>
      </div>

      <div className="flex flex-col md:flex-row items-start gap-8">
        {/* Nav Rail */}
        <div className="w-full md:w-64 flex-shrink-0 flex md:flex-col gap-2 overflow-x-auto pb-2 md:pb-0">
          {tabs.filter(t => t.show !== false).map((tab) => {
            const isActive = pathname === tab.path;
            return (
              <Link
                key={tab.name}
                href={tab.path}
                className={clsx(
                  "flex items-center gap-3 px-4 py-3 border whitespace-nowrap transition-colors",
                  isActive 
                    ? "bg-stitch-primary/10 border-stitch-primary text-stitch-primary font-bold" 
                    : "border-stitch-outline-variant bg-stitch-surface-container-lowest hover:bg-stitch-surface text-stitch-secondary hover:text-stitch-on-surface font-medium"
                )}
              >
                <tab.icon className={clsx("w-4 h-4", isActive ? "text-stitch-primary" : "text-stitch-secondary")} />
                <span className="text-xs font-mono uppercase tracking-widest">{tab.name}</span>
              </Link>
            )
          })}
        </div>

        {/* Content Area */}
        <div className="flex-grow w-full">
          {children}
        </div>
      </div>
    </div>
  );
}
