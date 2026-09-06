'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Compass, Calendar, User, Bell, ChevronDown } from 'lucide-react';
import clsx from 'clsx';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { useUnreadCount } from '../../hooks/useNotifications';
import { BackButton } from '../ui/BackButton';
import { StudentNotificationPopover } from '../notifications/StudentNotificationPopover';
import { useClubAdmin } from './ClubAdminProvider';
import { ClubAdminToggle } from './ClubAdminToggle';

const studentNavItems = [
  { label: 'Home', href: '/student/home', icon: Home },
  { label: 'Campus', href: '/student/campus', icon: Compass, exactMatch: false },
  { label: 'My Events', href: '/student/events', icon: Calendar },
  { label: 'Profile', href: '/student/profile', icon: User, exactMatch: false },
];

const adminNavItems = [
  { label: 'Club Hub', href: '/student/manage/club', icon: Compass },
  { label: 'Events', href: '/student/manage/events', icon: Calendar, exactMatch: false },
];

import { useRealtimeNotifications } from '../../hooks/useRealtimeNotifications';

export function StudentAppShell({ children }: { children: React.ReactNode }) {
  useRealtimeNotifications();
  const pathname = usePathname();
  const { data: user, isLoading: isUserLoading } = useCurrentUser();
  const { isClubAdminMode } = useClubAdmin();

  const navItems = isClubAdminMode ? adminNavItems : studentNavItems;

  const isActive = (item: { href: string; exactMatch?: boolean }) => {
    if (item.exactMatch === false) {
      return pathname === item.href || pathname.startsWith(`${item.href}/`);
    }
    return pathname === item.href;
  };

  const segments = pathname.split('/').filter(Boolean);
  const isDeepRoute = segments.length > (segments[1] === 'campus' || segments[1] === 'manage' ? 3 : 2);

  const isCampusActive = !isClubAdminMode && isActive({ href: '/student/campus', exactMatch: false });

  return (
    <div className="min-h-screen bg-stitch-surface-container-lowest text-stitch-on-surface flex flex-col font-stitch-body stitch-text-body-md pb-[64px] md:pb-0">
      
      {/* Global Header (Desktop & Mobile) */}
      <header className="bg-stitch-surface-container-lowest border-b border-stitch-outline-variant sticky top-0 z-50">
        <div className="flex justify-between items-center w-full px-stitch-margin-mobile md:px-stitch-margin-desktop py-stitch-md max-w-[1440px] mx-auto">
          
          {/* Brand & Mobile Back Button */}
          <div className="flex items-center gap-stitch-xl">
            {isDeepRoute ? (
              <BackButton className="md:hidden" />
            ) : null}
            <Link aria-label="NST Events Home" href={isClubAdminMode ? "/student/manage/club" : "/student/home"} className={clsx("font-stitch-headline text-[32px] font-bold text-stitch-primary tracking-tight", isDeepRoute ? "hidden md:block" : "block")}>
              NST
            </Link>

            {/* Navigation Links (Desktop) */}
            <nav aria-label="Main Navigation" className="hidden md:flex items-center gap-stitch-lg font-stitch-label text-[13px] uppercase tracking-widest font-medium">
              {!isClubAdminMode ? (
                <>
                  <Link aria-current={isActive({ href: '/student/home' }) ? 'page' : undefined} href="/student/home" className={clsx(
                    "pb-1 transition-all duration-200", 
                    isActive({ href: '/student/home' }) ? "text-stitch-primary border-b-2 border-stitch-primary" : "text-stitch-secondary hover:text-stitch-primary"
                  )}>
                    Home
                  </Link>
                  
                  {/* Campus Dropdown */}
                  <div className="relative group">
                    <Link 
                      href="/student/campus" 
                      className={clsx(
                        "flex items-center gap-stitch-xs pb-1 transition-colors relative z-10",
                        isCampusActive ? "text-stitch-primary border-b-2 border-stitch-primary" : "text-stitch-secondary hover:text-stitch-primary"
                      )}
                    >
                      Campus
                      <ChevronDown className="w-4 h-4 transition-transform duration-200 group-hover:rotate-180" />
                    </Link>
                    
                    {/* Nested Menu Container with transparent spacer for unbroken hit area */}
                    <div className="absolute top-full left-0 pt-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                      <div className="w-48 bg-stitch-surface-container-lowest border border-stitch-outline-variant shadow-sm">
                        <Link href="/student/campus/discover" className="block px-stitch-md py-stitch-sm text-stitch-secondary hover:text-stitch-primary hover:bg-stitch-surface border-b border-stitch-outline-variant transition-colors">Discover</Link>
                        <Link href="/student/campus/leaderboard" className="block px-stitch-md py-stitch-sm text-stitch-secondary hover:text-stitch-primary hover:bg-stitch-surface border-b border-stitch-outline-variant transition-colors">Leaderboard</Link>
                        <Link href="/student/campus/clubs" className="block px-stitch-md py-stitch-sm text-stitch-secondary hover:text-stitch-primary hover:bg-stitch-surface transition-colors">Clubs</Link>
                      </div>
                    </div>
                  </div>

                  <Link aria-current={isActive({ href: '/student/events' }) ? 'page' : undefined} href="/student/events" className={clsx(
                    "pb-1 transition-all duration-200", 
                    isActive({ href: '/student/events' }) ? "text-stitch-primary border-b-2 border-stitch-primary" : "text-stitch-secondary hover:text-stitch-primary"
                  )}>
                    My Events
                  </Link>
                </>
              ) : (
                <>
                  <Link aria-current={isActive({ href: '/student/manage/club' }) ? 'page' : undefined} href="/student/manage/club" className={clsx(
                    "pb-1 transition-all duration-200", 
                    isActive({ href: '/student/manage/club' }) ? "text-stitch-primary border-b-2 border-stitch-primary" : "text-stitch-secondary hover:text-stitch-primary"
                  )}>
                    Club Hub
                  </Link>
                  <Link aria-current={isActive({ href: '/student/manage/events', exactMatch: false }) ? 'page' : undefined} href="/student/manage/events" className={clsx(
                    "pb-1 transition-all duration-200", 
                    isActive({ href: '/student/manage/events', exactMatch: false }) ? "text-stitch-primary border-b-2 border-stitch-primary" : "text-stitch-secondary hover:text-stitch-primary"
                  )}>
                    Events
                  </Link>
                </>
              )}
            </nav>
          </div>

          {/* Trailing Actions */}
          <div className="flex items-center gap-stitch-lg">
            
            <ClubAdminToggle />

            {/* Notifications */}
            <StudentNotificationPopover />

            {/* Profile Control (Desktop shows Name) */}
            <Link aria-label="User Profile" href="/student/profile" className="flex items-center gap-stitch-sm text-stitch-on-surface hover:text-stitch-primary transition-colors group">
              <div className="w-8 h-8 rounded-none border border-stitch-outline-variant bg-stitch-surface-variant flex items-center justify-center transition-colors overflow-hidden group-hover:border-stitch-primary">
                {isUserLoading ? (
                  <div className="w-full h-full bg-stitch-surface-variant animate-pulse" />
                ) : user?.avatar_url ? (
                  <img src={user.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-4 h-4" />
                )}
              </div>
              <span className="font-stitch-label text-[13px] tracking-widest hidden md:block font-medium">
                {user?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'Student'}
              </span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-grow flex w-full max-w-[1440px] mx-auto">
        {children}
      </div>

      {/* Mobile Bottom Navigation (Hidden on Desktop & Deep Routes) */}
      <nav className={clsx(
        "fixed bottom-0 w-full bg-stitch-surface-container-lowest border-t border-stitch-outline-variant z-50 md:hidden",
        isDeepRoute && "hidden"
      )}>
        <div className="flex justify-around items-center h-[64px]">
          {navItems.map((item) => {
            const active = isActive(item);
            return (
              <Link
                key={item.label}
                href={item.href}
                className={clsx(
                  "flex flex-col items-center justify-center w-full h-full relative transition-colors",
                  active ? "text-stitch-primary" : "text-stitch-secondary hover:text-stitch-primary"
                )}
              >
                <item.icon className="w-6 h-6" strokeWidth={active ? 2.5 : 2} />
                <span className="font-stitch-label text-[10px] mt-stitch-xs uppercase">{item.label}</span>
                {active && (
                  <div className="absolute top-0 w-1/2 h-[2px] bg-stitch-primary"></div>
                )}
              </Link>
            );
          })}
        </div>
      </nav>

    </div>
  );
}
