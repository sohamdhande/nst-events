'use client';

import React from 'react';
import { useClubAdmin } from './ClubAdminProvider';
import { ChevronDown } from 'lucide-react';
import clsx from 'clsx';
import { useRouter, usePathname } from 'next/navigation';

export function ClubAdminToggle() {
  const { isClubAdminMode, setClubAdminMode, activeClubId, setActiveClubId, managedClubs, isHydrated } = useClubAdmin();
  const router = useRouter();
  const pathname = usePathname();

  // Do not render anything if not hydrated or if they have no managed clubs
  if (!isHydrated || managedClubs.length === 0) {
    return null;
  }

  const activeClub = managedClubs.find(c => c.id === activeClubId);

  const handleToggle = (toAdmin: boolean) => {
    setClubAdminMode(toAdmin);
    if (toAdmin) {
      router.push(`/student/manage/club`);
    } else {
      router.push(`/student/home`);
    }
  };

  const handleClubChange = (clubId: string) => {
    setActiveClubId(clubId);
    // If we are currently on a manage route, we might want to redirect to the new club's hub.
    // For simplicity, always go to club hub on change if in admin mode
    if (isClubAdminMode) {
      router.push(`/student/manage/club`);
    }
  };

  return (
    <div className="flex items-center gap-2 border border-stitch-outline-variant bg-stitch-surface p-1 shadow-sm font-stitch-label text-[11px] uppercase tracking-widest font-semibold hidden md:flex">
      {/* Student Mode Button */}
      <button 
        onClick={() => handleToggle(false)}
        className={clsx(
          "px-3 py-1.5 transition-colors",
          !isClubAdminMode ? "bg-stitch-primary text-stitch-on-primary" : "text-stitch-secondary hover:text-stitch-primary hover:bg-stitch-surface-variant"
        )}
      >
        STUDENT
      </button>

      {/* Club Admin Mode Button & Dropdown */}
      <div className={clsx(
        "flex items-center transition-colors relative group",
        isClubAdminMode ? "bg-stitch-primary text-stitch-on-primary" : "text-stitch-secondary hover:bg-stitch-surface-variant hover:text-stitch-primary"
      )}>
        <button 
          onClick={() => {
            if (!isClubAdminMode) handleToggle(true);
          }}
          className="pl-3 py-1.5 flex items-center h-full"
        >
          CLUB ADMIN
          {isClubAdminMode && activeClub && (
            <span className="ml-1 opacity-80">· {activeClub.name}</span>
          )}
        </button>

        {isClubAdminMode && managedClubs.length > 1 && (
          <div className="relative flex items-center h-full">
            <div className="px-2 py-1.5 cursor-pointer h-full flex items-center">
              <ChevronDown className="w-3 h-3" />
            </div>
            
            {/* Dropdown Menu */}
            <div className="absolute top-full right-0 mt-1 w-48 bg-stitch-surface-container-lowest border border-stitch-outline-variant shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
              {managedClubs.map(club => (
                <button
                  key={club.id}
                  onClick={() => handleClubChange(club.id)}
                  className={clsx(
                    "w-full text-left px-3 py-2 border-b border-stitch-outline-variant last:border-b-0 hover:bg-stitch-surface hover:text-stitch-primary transition-colors",
                    activeClubId === club.id ? "text-stitch-primary bg-stitch-surface-variant" : "text-stitch-secondary"
                  )}
                >
                  {club.name}
                </button>
              ))}
            </div>
          </div>
        )}
        
        {(!isClubAdminMode || managedClubs.length <= 1) && (
          <div className="pr-3" />
        )}
      </div>
    </div>
  );
}
