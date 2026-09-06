'use client';

import React, { useEffect, Fragment } from 'react';
import { useRouter } from 'next/navigation';
import { useNotifications, useReadNotification, Notification } from '../../../../hooks/useNotifications';
import { resolveStudentNotificationTarget } from '../../../../lib/student-notification-utils';

export default function StudentNotificationsPage() {
  const router = useRouter();
  
  // Use the hook without filtering by unread to get the full chronological list
  const { 
    data, 
    isLoading, 
    isError, 
    hasNextPage, 
    fetchNextPage, 
    isFetchingNextPage 
  } = useNotifications();
  
  const { mutate: markAsRead } = useReadNotification();

  const handleNotificationClick = (notif: Notification, targetHref: string | null) => {
    if (!notif.readAt) {
      markAsRead(notif.id);
    }
    if (targetHref) {
      router.push(targetHref);
    }
  };

  const formatRelativeTime = (isoString: string) => {
    const date = new Date(isoString);
    const diffMs = Date.now() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHrs = Math.floor(diffMins / 60);
    if (diffHrs < 24) return `${diffHrs}h ago`;
    const diffDays = Math.floor(diffHrs / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  // Check if we have any notifications at all
  const isEmpty = !isLoading && !isError && data?.pages[0]?.data.length === 0;

  return (
    <div className="w-full max-w-[720px] mx-auto px-4 md:px-6 py-8 md:py-12 font-sans text-stitch-on-surface">
      
      {/* Header */}
      <div className="mb-8 border-b border-stitch-outline-variant pb-4">
        <h1 
          className="text-3xl md:text-4xl font-black tracking-tight mb-2 uppercase"
          style={{ fontFamily: 'Syne, sans-serif' }}
        >
          Notifications
        </h1>
        <p className="text-xs font-mono text-stitch-secondary uppercase tracking-widest">
          Recent activity and updates
        </p>
      </div>

      {/* States */}
      <div className="space-y-4">
        
        {/* Loading State */}
        {isLoading && (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="p-5 border border-stitch-outline-variant animate-pulse bg-stitch-surface-container-lowest">
                <div className="flex gap-4">
                  <div className="mt-1 w-2 h-2 rounded-full bg-stitch-surface-variant shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-stitch-surface-variant w-2/3" />
                    <div className="h-3 bg-stitch-surface-variant w-1/2" />
                    <div className="h-2 bg-stitch-surface-variant w-1/4 mt-4" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error State */}
        {isError && (
          <div className="p-8 border border-stitch-outline-variant text-center bg-stitch-surface-container-lowest">
            <p className="text-sm font-mono text-stitch-secondary uppercase tracking-widest">
              Failed to load notifications.
            </p>
            <button 
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 border border-stitch-on-surface font-mono text-xs uppercase font-bold hover:bg-stitch-surface transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {/* Empty State */}
        {isEmpty && (
          <div className="py-16 text-center">
            <h2 
              className="text-xl font-bold tracking-tight mb-2"
              style={{ fontFamily: 'Syne, sans-serif' }}
            >
              YOU'RE ALL CAUGHT UP
            </h2>
            <p className="font-mono text-xs text-stitch-secondary uppercase tracking-widest">
              No new notifications.
            </p>
          </div>
        )}

        {/* Populated List */}
        {!isLoading && !isError && !isEmpty && data && (
          <div className="flex flex-col gap-3">
            {data.pages.map((page, i) => (
              <Fragment key={i}>
                {page.data.map((notif) => {
                  const isUnread = !notif.readAt;
                  const targetHref = resolveStudentNotificationTarget(notif);
                  
                  return (
                    <div
                      key={notif.id}
                      onClick={() => handleNotificationClick(notif, targetHref)}
                      className={`
                        group relative border border-stitch-outline-variant p-4 md:p-5 transition-colors 
                        ${targetHref ? 'cursor-pointer hover:border-stitch-outline' : 'cursor-default'}
                        ${isUnread ? 'bg-stitch-on-surface/[0.02] dark:bg-stitch-on-surface/[0.05]' : 'bg-stitch-surface-container-lowest'}
                      `}
                      role={targetHref ? "link" : "article"}
                      tabIndex={targetHref ? 0 : undefined}
                    >
                      <div className="flex gap-4">
                        {/* Unread Indicator */}
                        <div className="mt-1.5 shrink-0 w-2 h-2 flex justify-center">
                          {isUnread && (
                            <div className="w-2 h-2 bg-blue-600 rounded-full shadow-[0_0_8px_rgba(37,99,235,0.4)]" />
                          )}
                        </div>
                        
                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <h3 className={`
                            text-sm md:text-base tracking-tight leading-snug mb-1
                            ${isUnread ? 'font-bold text-stitch-on-surface' : 'font-medium text-stitch-on-surface-variant'}
                          `}>
                            {notif.title || notif.body}
                          </h3>
                          
                          {notif.title && (
                            <p className={`
                              text-sm leading-relaxed mb-3
                              ${isUnread ? 'text-stitch-on-surface' : 'text-stitch-secondary'}
                            `}>
                              {notif.body}
                            </p>
                          )}
                          
                          <div className="flex items-center justify-between mt-3">
                            <span className="font-mono text-[10px] text-stitch-secondary uppercase tracking-widest">
                              {formatRelativeTime(notif.createdAt)}
                            </span>
                            
                            {targetHref && (
                              <span className="font-mono text-[10px] uppercase font-bold tracking-widest text-stitch-on-surface opacity-0 group-hover:opacity-100 transition-opacity">
                                View &rarr;
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </Fragment>
            ))}
          </div>
        )}

        {/* Load More Pagination */}
        {hasNextPage && (
          <div className="pt-6 text-center border-t border-transparent">
            <button
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              className="px-6 py-3 border border-stitch-outline-variant bg-stitch-surface-container-lowest font-mono text-xs uppercase font-bold tracking-widest hover:border-stitch-on-surface hover:bg-stitch-surface transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isFetchingNextPage ? 'Loading...' : 'Load More'}
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
