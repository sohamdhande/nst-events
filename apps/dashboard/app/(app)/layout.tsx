'use client';

import { ReactNode, useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { getWebAuthStore } from '../../lib/auth-store';
import { AppShell } from '../../components/layout/AppShell';
import { apiClient } from '../../lib/api';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { Spin, Layout } from 'antd';

// Module-level promise to prevent duplicate concurrent refresh requests across remounts
let refreshPromise: Promise<string | null> | null = null;

export default function AppLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const store = getWebAuthStore();
  const [isHydrating, setIsHydrating] = useState(!store.accessToken);
  const [isAuthenticated, setIsAuthenticated] = useState(!!store.accessToken);

  const { data: user, isLoading: isUserLoading } = useCurrentUser();

  useEffect(() => {
    if (store.accessToken) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsHydrating(false);
      return;
    }

    const bootstrap = async () => {
      try {
        if (!refreshPromise) {
          refreshPromise = apiClient<{ access_token: string }>('/auth/refresh', { method: 'POST' }).then(data => {
            return data?.access_token || null;
          }).catch(() => null);
        }
        
        const token = await refreshPromise;
        if (token) {
          store.setAccessToken(token);
          setIsAuthenticated(true);
        } else {
          setIsAuthenticated(false);
          router.push('/login');
        }
      } catch {
        setIsAuthenticated(false);
        router.push('/login');
      } finally {
        setIsHydrating(false);
        refreshPromise = null;
      }
    };

    bootstrap();
  }, [router, store]);

  useEffect(() => {
    // If authenticated and user is loaded, check role
    if (isAuthenticated && user) {
      const hasOrganizerClubRole = user.club_memberships?.some(m => m.role === 'CLUB_ADMIN' || m.role === 'CORE_MEMBER');
      if (user.global_role === 'STUDENT' && !hasOrganizerClubRole && pathname !== '/student-access') {
        router.replace('/student-access');
      }
    }
  }, [isAuthenticated, user, router, pathname]);

  if (isHydrating || (isAuthenticated && isUserLoading)) {
    return (
      <Layout className="h-screen w-full flex items-center justify-center bg-gray-50">
        <Spin size="large" />
      </Layout>
    );
  }

  const isStrictStudent = user?.global_role === 'STUDENT' && !user?.club_memberships?.some(m => m.role === 'CLUB_ADMIN' || m.role === 'CORE_MEMBER');
  if (!isAuthenticated || isStrictStudent) {
    return null;
  }

  return (
    <AppShell>
      {children}
    </AppShell>
  );
}
