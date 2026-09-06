import React from 'react';
import { Notification } from '../hooks/useNotifications';

export function resolveStudentNotificationTarget(notification: Notification): string | null {
  const meta = notification.metadata || {};
  const routing = meta.routing || {};
  const entityIds = meta.entity_ids || {};
  
  const eventId = entityIds.event_id || routing.params?.event_id;

  const type = notification.type;

  // 1. Teams -> Student Team Hub
  if (
    [
      'TEAM_REGISTERED', 
      'TEAM_WAITLISTED', 
      'TEAM_CANCELLED', 
      'TEAM_LEADERSHIP_TRANSFERRED', 
      'TEAM_MEMBER_REMOVED', 
      'TEAM_WAITLIST_PROMOTED',
      'TEAM_INVITATION' // if this exists
    ].includes(type)
  ) {
    if (eventId) return `/student/events/${eventId}/team`;
  }

  // 2. Events & Attendance -> Student Event Detail
  if (
    [
      'EVENT_REMINDER', 
      'WAITLIST_PROMOTED',
      'ATTENDANCE_DISPUTE_RESOLVED', 
      'ATTENDANCE_ALERT'
    ].includes(type)
  ) {
    if (eventId) return `/student/events/${eventId}`;
  }

  // 3. Fallback routing
  if (routing.fallback && typeof routing.fallback === 'string') {
    // If backend sends a student-specific fallback path
    if (routing.fallback.startsWith('/student/')) return routing.fallback;
  }

  // SPECIFICATION GAP: Club announcements don't have a specific student club detail route yet.
  // SPECIFICATION GAP: System alerts don't have a specific route.
  return null;
}
