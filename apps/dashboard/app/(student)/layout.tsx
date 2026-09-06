'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { getWebAuthStore } from '../../lib/auth-store';
import { apiClient, refreshToken } from '../../lib/api';
import { StudentAppShell } from '../../components/layout/StudentAppShell';
import { ClubAdminProvider } from '../../components/layout/ClubAdminProvider';


export default function StudentLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const store = getWebAuthStore();
  const [isHydrating, setIsHydrating] = useState(!store.accessToken);
  const [isAuthenticated, setIsAuthenticated] = useState(!!store.accessToken);

  useEffect(() => {
    if (store.accessToken) {
      setIsHydrating(false);
      return;
    }

    const bootstrap = async () => {
      try {
        const token = await refreshToken();
        if (token) {
          store.setAccessToken(token);
          setIsAuthenticated(true);
        } else {
          setIsAuthenticated(false);
          const currentPath = pathname + (searchParams.toString() ? `?${searchParams.toString()}` : '');
          router.push(`/login?return_to=${encodeURIComponent(currentPath)}`);
        }
      } catch {
        setIsAuthenticated(false);
        const currentPath = pathname + (searchParams.toString() ? `?${searchParams.toString()}` : '');
        router.push(`/login?return_to=${encodeURIComponent(currentPath)}`);
      } finally {
        setIsHydrating(false);
      }
    };

    bootstrap();
  }, [router, store, pathname, searchParams]);

  if (isHydrating) {
    return (
      <div className="min-h-screen bg-m3-surface flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-m3-surface-variant/50"></div>
          <div className="w-24 h-4 rounded-md bg-m3-surface-variant/50"></div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; // Will redirect to login
  }

  return (
    <ClubAdminProvider>
      <StudentAppShell>
        {children}
      </StudentAppShell>
    </ClubAdminProvider>
  );
}
