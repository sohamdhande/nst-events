'use client';

import { getWebAuthStore } from '../../lib/auth-store';
import { useRouter } from 'next/navigation';
import { useLogout } from '../../hooks/useLogout';

export function TopBar() {
  const { mutate: logout, isPending } = useLogout();

  return (
    <header className="h-16 border-b border-gray-200 bg-white flex items-center justify-between px-6">
      <div className="flex items-center md:hidden">
        <h1 className="text-xl font-bold text-gray-900">NST Events</h1>
      </div>
      <div className="hidden md:block"></div>
      <div className="flex items-center gap-4">
        <button
          onClick={() => logout()}
          disabled={isPending}
          className="text-sm font-medium text-gray-600 hover:text-gray-900 disabled:opacity-50 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-base focus-visible:ring-offset-2"
        >
          {isPending ? 'Signing out...' : 'Sign out'}
        </button>
      </div>
    </header>
  );
}
