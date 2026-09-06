'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bell } from 'lucide-react';
import { useNotifications, useReadNotification, useUnreadCount, Notification } from '../../hooks/useNotifications';
import { resolveStudentNotificationTarget } from '../../lib/student-notification-utils';

export function StudentNotificationPopover() {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const { data: unreadData } = useUnreadCount();
  const { data, isLoading, isError } = useNotifications();
  const { mutate: markAsRead } = useReadNotification();

  // Close popover when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsOpen(false);
    }
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const notifications = data?.pages[0]?.data.slice(0, 5) || [];
  const unreadCount = unreadData?.unread_count || 0;

  const handleNotificationClick = (notification: Notification, targetHref: string | null) => {
    if (!notification.readAt) {
      markAsRead(notification.id);
    }
    setIsOpen(false);
    if (targetHref) {
      router.push(targetHref);
    }
  };

  const formatRelativeTime = (isoString: string) => {
    const diffMs = Date.now() - new Date(isoString).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHrs = Math.floor(diffMins / 60);
    if (diffHrs < 24) return `${diffHrs}h ago`;
    return `${Math.floor(diffHrs / 24)}d ago`;
  };

  return (
    <div className="relative" ref={popoverRef}>
      {/* Trigger */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Notifications"
        aria-expanded={isOpen}
        className="relative text-stitch-on-surface hover:text-stitch-secondary transition-colors p-2 rounded flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-stitch-outline-variant"
      >
        <Bell className="w-5 h-5" strokeWidth={2} />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-blue-600 rounded-full border border-white"></span>
        )}
      </button>

      {/* Popover Content */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-72 bg-stitch-surface-container-lowest border border-stitch-outline-variant shadow-sm z-50 flex flex-col font-sans">
          {/* Header */}
          <div className="px-3 py-2 border-b border-stitch-outline-variant flex items-center justify-between">
            <h3 className="font-mono text-[10px] uppercase tracking-widest font-bold text-stitch-secondary">
              Notifications
            </h3>
            {unreadCount > 0 && (
              <span className="font-mono text-[10px] bg-stitch-surface-variant px-1.5 py-0.5 rounded text-stitch-on-surface-variant">
                {unreadCount} New
              </span>
            )}
          </div>

          {/* List */}
          <div className="max-h-[300px] overflow-y-auto">
            {isLoading && (
              <div className="p-4 space-y-4">
                <div className="animate-pulse flex space-x-3">
                  <div className="flex-1 space-y-2 py-1">
                    <div className="h-3 bg-stitch-surface-variant w-3/4"></div>
                    <div className="h-3 bg-stitch-surface-variant w-1/2"></div>
                  </div>
                </div>
              </div>
            )}

            {isError && (
              <div className="p-6 text-center text-xs font-mono text-stitch-secondary">
                Failed to load notifications.
              </div>
            )}

            {!isLoading && !isError && notifications.length === 0 && (
              <div className="p-6 text-center text-xs font-mono text-stitch-secondary">
                You're all caught up.
              </div>
            )}

            {!isLoading && !isError && notifications.length > 0 && (
              <div className="divide-y divide-stitch-outline-variant">
                {notifications.map((notif) => {
                  const isUnread = !notif.readAt;
                  const targetHref = resolveStudentNotificationTarget(notif);
                  
                  return (
                    <div
                      key={notif.id}
                      onClick={() => handleNotificationClick(notif, targetHref)}
                      className={`block px-3 py-2.5 border-b border-stitch-outline-variant last:border-0 transition-colors cursor-pointer hover:bg-stitch-surface-variant ${isUnread ? 'bg-stitch-surface dark:bg-stitch-surface-variant' : 'bg-stitch-surface-container-lowest'}`}
                      role={targetHref ? "link" : "button"}
                      tabIndex={0}
                    >
                      <div className="flex gap-2">
                        {/* Unread Indicator dot */}
                        <div className="mt-1 shrink-0 w-1.5 h-1.5">
                          {isUnread && <div className="w-1.5 h-1.5 bg-blue-600 rounded-full" />}
                        </div>
                        
                        <div className="flex-1 min-w-0 space-y-0.5">
                          <p className={`text-[12px] tracking-tight leading-snug truncate ${isUnread ? 'font-bold text-stitch-on-surface' : 'font-medium text-stitch-on-surface-variant'}`}>
                            {notif.title || notif.body}
                          </p>
                          {notif.title && (
                            <p className="text-[11px] text-stitch-secondary line-clamp-1 leading-snug">
                              {notif.body}
                            </p>
                          )}
                          <p className="font-mono text-[9px] text-stitch-secondary uppercase tracking-widest pt-0.5">
                            {formatRelativeTime(notif.createdAt)}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-stitch-outline-variant bg-stitch-surface">
            <Link
              href="/student/notifications"
              onClick={() => setIsOpen(false)}
              className="block w-full px-3 py-2 text-center text-[10px] font-mono uppercase tracking-widest text-stitch-secondary hover:text-stitch-on-surface hover:bg-stitch-surface-variant transition-colors font-bold"
            >
              View All
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
