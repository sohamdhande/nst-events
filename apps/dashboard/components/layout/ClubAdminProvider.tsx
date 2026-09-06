'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo } from 'react';
import { useCurrentUser } from '../../hooks/useCurrentUser';

interface ClubAdminContextType {
  isClubAdminMode: boolean;
  setClubAdminMode: (active: boolean) => void;
  activeClubId: string | null;
  setActiveClubId: (clubId: string) => void;
  managedClubs: { id: string; name: string }[];
  isHydrated: boolean;
}

const ClubAdminContext = createContext<ClubAdminContextType | undefined>(undefined);

export function ClubAdminProvider({ children }: { children: ReactNode }) {
  const { data: user } = useCurrentUser();
  
  const [isHydrated, setIsHydrated] = useState(false);
  const [isClubAdminMode, setIsClubAdminMode] = useState(false);
  const [activeClubId, setActiveClubId] = useState<string | null>(null);

  const managedClubs = useMemo(() => {
    if (!user?.club_memberships) return [];
    return user.club_memberships
      .filter(m => m.role === 'CLUB_ADMIN')
      .map(m => ({ id: m.club_id, name: m.club_name }));
  }, [user]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedMode = localStorage.getItem('nst_club_admin_mode');
      const storedClubId = localStorage.getItem('nst_active_club_id');
      
      if (storedMode === 'true') {
        setIsClubAdminMode(true);
      }
      if (storedClubId) {
        setActiveClubId(storedClubId);
      }
      setIsHydrated(true);
    }
  }, []);

  // Ensure activeClubId is valid when managedClubs change or initially load
  useEffect(() => {
    if (isHydrated && managedClubs.length > 0) {
      if (!activeClubId || !managedClubs.some(c => c.id === activeClubId)) {
        setActiveClubId(managedClubs[0].id);
        localStorage.setItem('nst_active_club_id', managedClubs[0].id);
      }
    }
    // If they have no managed clubs but somehow are in admin mode, turn it off
    if (isHydrated && managedClubs.length === 0 && isClubAdminMode) {
      setIsClubAdminMode(false);
      localStorage.removeItem('nst_club_admin_mode');
    }
  }, [isHydrated, managedClubs, activeClubId, isClubAdminMode]);

  const handleSetMode = (active: boolean) => {
    setIsClubAdminMode(active);
    if (active) {
      localStorage.setItem('nst_club_admin_mode', 'true');
    } else {
      localStorage.removeItem('nst_club_admin_mode');
    }
  };

  const handleSetClub = (clubId: string) => {
    setActiveClubId(clubId);
    localStorage.setItem('nst_active_club_id', clubId);
  };

  return (
    <ClubAdminContext.Provider 
      value={{ 
        isClubAdminMode, 
        setClubAdminMode: handleSetMode, 
        activeClubId, 
        setActiveClubId: handleSetClub,
        managedClubs,
        isHydrated
      }}
    >
      {children}
    </ClubAdminContext.Provider>
  );
}

export function useClubAdmin() {
  const context = useContext(ClubAdminContext);
  if (context === undefined) {
    throw new Error('useClubAdmin must be used within a ClubAdminProvider');
  }
  return context;
}
