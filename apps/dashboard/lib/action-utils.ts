import { Event } from '../hooks/useEvents';
import { QueueStats } from '../hooks/useQueueMonitoring';
import { Notification } from '../hooks/useNotifications';
import { resolveNotificationTarget } from './notification-utils';
import { resolveEventLockState } from './event-utils';

export type ActionPriority = 'HIGH' | 'MEDIUM' | 'LOW';

export type ManagementActionSource =
  | { type: 'EVENT'; data: Event; currentUserRoles: { isGlobalAdmin: boolean; isMentor: boolean; isClubAdmin: boolean; isCoreMember: boolean } }
  | { type: 'QUEUE'; data: QueueStats; currentUserRoles: { isGlobalAdmin: boolean; isMentor: boolean; isClubAdmin: boolean; isCoreMember: boolean } }
  | { type: 'NOTIFICATION'; data: Notification; currentUserRoles: { isGlobalAdmin: boolean; isMentor: boolean; isClubAdmin: boolean; isCoreMember: boolean } };

export interface ManagementAction {
  id: string;
  priority: ActionPriority;
  label: string;
  description: string;
  href: string;
  actionable: boolean;
  sourceType: 'EVENT' | 'QUEUE' | 'NOTIFICATION';
  timestamp: string; // ISO string
}

export function resolveManagementActions(source: ManagementActionSource): ManagementAction[] {
  const now = new Date().toISOString();
  const actions: ManagementAction[] = [];

  if (source.type === 'EVENT') {
    const event = source.data;
    const { isGlobalAdmin, isMentor, isClubAdmin, isCoreMember } = source.currentUserRoles;
    
    // Draft -> requires submission (Club Admin)
    if (event.state === 'DRAFT' && isClubAdmin) {
      actions.push({
        id: `event-${event.id}-draft`,
        priority: 'HIGH',
        label: 'Complete Event',
        description: event.title,
        href: `/events/${event.id}`,
        actionable: true,
        sourceType: 'EVENT',
        timestamp: event.startTime || now
      });
    }
    
    // Pending Approval -> requires approval (Global Admin or Mentor)
    if (event.state === 'PENDING_APPROVAL' && (isGlobalAdmin || isMentor)) {
      actions.push({
        id: `event-${event.id}-approval`,
        priority: 'HIGH',
        label: 'Review Event',
        description: event.title,
        href: `/events/${event.id}`,
        actionable: true,
        sourceType: 'EVENT',
        timestamp: event.startTime || now
      });
    }

    // Capacity checks
    if (event.maxCapacity !== null && event.maxCapacity > 0) {
      if (event.registrationCount >= event.maxCapacity) {
        actions.push({
          id: `event-${event.id}-capacity`,
          priority: 'MEDIUM',
          label: 'Review Registrations',
          description: `${event.title} is full`,
          href: `/events/${event.id}/registrations`,
          actionable: true,
          sourceType: 'EVENT',
          timestamp: event.startTime || now
        });
      } else if (event.registrationCount / event.maxCapacity >= 0.9) {
        actions.push({
          id: `event-${event.id}-capacity`,
          priority: 'MEDIUM',
          label: 'Review Registration Capacity',
          description: `${event.title} is nearly full`,
          href: `/events/${event.id}/registrations`,
          actionable: true,
          sourceType: 'EVENT',
          timestamp: event.startTime || now
        });
      }
    }

    // Below Minimum Team Attention
    if ((isClubAdmin || isCoreMember || isGlobalAdmin) && event.below_minimum_team_count && event.below_minimum_team_count > 0) {
      actions.push({
        id: `event-${event.id}-teams-attention`,
        priority: 'HIGH',
        label: 'Teams Require Attention',
        description: `${event.below_minimum_team_count} team${event.below_minimum_team_count === 1 ? ' is' : 's are'} below minimum`,
        href: `/events/${event.id}/teams`,
        actionable: true,
        sourceType: 'EVENT',
        timestamp: event.startTime || now
      });
    }

    // Unlock Action
    const lockState = resolveEventLockState(event as Pick<Event, 'lock_state'>);
    const canUnlock = (isGlobalAdmin || isClubAdmin || isMentor) && event.state === 'PUBLISHED';
    if (canUnlock && lockState === 'MANUALLY_LOCKED') {
      actions.push({
        id: `event-${event.id}-unlock`,
        priority: 'HIGH',
        label: 'Unlock Event',
        description: `${event.title} is manually locked`,
        href: `/events/${event.id}`,
        actionable: true,
        sourceType: 'EVENT',
        timestamp: event.startTime || now
      });
    }

    return actions;
  }

  if (source.type === 'QUEUE') {
    const stats = source.data;
    const { isGlobalAdmin } = source.currentUserRoles;

    if (isGlobalAdmin && stats.dead_letter_count > 0) {
      actions.push({
        id: 'queue-dead-letter',
        priority: 'HIGH',
        label: 'Review Dead-Letter Jobs',
        description: `${stats.dead_letter_count} jobs failed processing`,
        href: `/admin/queues`,
        actionable: true,
        sourceType: 'QUEUE',
        timestamp: now
      });
    }
    
    return actions;
  }

  if (source.type === 'NOTIFICATION') {
    const notif = source.data;
    const targetHref = resolveNotificationTarget(notif);
    
    // If we can't route it, it's not actionable on the dashboard
    if (!targetHref) return actions;

    let priority: ActionPriority = 'LOW';
    let label = 'Review Notification';

    // Map notification types to Priority & Standard Labels
    switch (notif.type) {
      case 'APPROVAL_REQUEST':
      case 'SYSTEM_ALERT':
      case 'ATTENDANCE_ALERT':
        priority = 'HIGH';
        if (notif.type === 'APPROVAL_REQUEST') label = 'Review Event';
        if (notif.type === 'ATTENDANCE_ALERT') label = 'Manage Attendance';
        break;
      
      case 'TEAM_WAITLISTED':
      case 'TEAM_CANCELLED':
      case 'TEAM_MEMBER_REMOVED':
      case 'WAITLIST_PROMOTED':
        priority = 'MEDIUM';
        if (notif.type.startsWith('TEAM_')) label = 'Manage Teams';
        break;
        
      case 'EVENT_APPROVED':
      case 'EVENT_REJECTED':
      case 'CLUB_ANNOUNCEMENT':
        priority = 'LOW';
        if (notif.type.startsWith('EVENT_')) label = 'View Event';
        break;
    }

    // Attempt to map to equivalent event IDs so we can deduplicate 
    // e.g. APPROVAL_REQUEST notification vs PENDING_APPROVAL event state
    const eventId = notif.metadata?.entity_ids?.event_id;
    let actionId = `notification-${notif.id}`;
    
    if (eventId) {
      if (notif.type === 'APPROVAL_REQUEST') {
        actionId = `event-${eventId}-approval`;
      } else if (notif.type === 'TEAM_WAITLISTED' || notif.type === 'TEAM_CANCELLED' || notif.type === 'TEAM_MEMBER_REMOVED') {
        // Map team notifications to the event-level attention item to deduplicate
        actionId = `event-${eventId}-teams-attention`;
      }
    }

    actions.push({
      id: actionId,
      priority,
      label,
      description: notif.title || notif.body,
      href: targetHref,
      actionable: true,
      sourceType: 'NOTIFICATION',
      timestamp: notif.createdAt
    });
    
    return actions;
  }

  return actions;
}

// Helper wrapper for backward compatibility with components expecting a single action
export function resolveManagementAction(source: ManagementActionSource): ManagementAction | null {
  const actions = resolveManagementActions(source);
  return actions.length > 0 ? actions[0] : null;
}
