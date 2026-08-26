'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '../../lib/utils';
import { ContextSwitcher } from '../ui/ContextSwitcher';

import { useCurrentUser } from '../../hooks/useCurrentUser';
import { isPlatformAdmin, isFacultyAdmin, canViewStudentDirectory } from '../../lib/auth-helpers';

export function Sidebar() {
  const pathname = usePathname();
  const { data: currentUser } = useCurrentUser();

  const platformAdmin = isPlatformAdmin(currentUser);
  const facultyAdmin = isFacultyAdmin(currentUser);
  const adminAccess = platformAdmin || facultyAdmin;

  const links = [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/events', label: 'Events' },
    { href: '/clubs', label: 'Clubs' },
    { href: '/notifications', label: 'Notifications' },
    { href: '/profile', label: 'Profile' },
  ];

  if (adminAccess) {
    links.push({ href: '/admin', label: 'Admin Hub' });
    links.push({ href: '/admin/approvals', label: 'Approvals' });
    
    if (canViewStudentDirectory(currentUser)) {
      links.push({ href: '/admin/users', label: 'Users & Roles' });
    }

    links.push({ href: '/admin/academic-programs', label: 'Academic Programs' });
    links.push({ href: '/admin/academic-batches', label: 'Academic Batches' });
  }

  if (platformAdmin) {
    links.push({ href: '/admin/audit-logs', label: 'Audit Logs' });
    links.push({ href: '/admin/queues', label: 'Queue Monitoring' });
  }

  return (
    <aside className="w-64 border-r border-gray-800 bg-gray-900 min-h-screen hidden md:flex flex-col">
      <div className="h-16 flex items-center px-6 border-b border-gray-800">
        <h1 className="text-xl font-bold text-white">NST Events</h1>
      </div>
      <ContextSwitcher />
      <nav className="flex-1 p-4 space-y-1">
        {links.map((link) => {
          const isActive = pathname === link.href || (link.href !== '/admin' && pathname.startsWith(`${link.href}/`)) || (link.href === '/admin' && pathname === '/admin');
          return (
            <Link 
              key={link.href}
              href={link.href} 
              className={cn(
                "block px-3 py-2 text-sm font-medium rounded-md",
                isActive 
                  ? "bg-gray-800 text-white" 
                  : "text-gray-300 hover:bg-gray-800 hover:text-white"
              )}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
