import React from 'react';
import { 
  CheckCircleOutlined, 
  CalendarOutlined, 
  TeamOutlined, 
  ClockCircleOutlined, 
  MonitorOutlined,
  AlertOutlined,
  InfoCircleOutlined
} from '@ant-design/icons';
import { Notification } from '../hooks/useNotifications';

export function resolveNotificationTarget(notification: Notification): string | null {
  const meta = notification.metadata || {};
  const routing = meta.routing || {};
  const entityIds = meta.entity_ids || {};
  
  const target = routing.target;
  const eventId = entityIds.event_id || routing.params?.event_id;
  const userId = entityIds.user_id || routing.params?.user_id;

  // 1. Explicit Routing Overrides
  if (target === 'team_operations' && eventId) return `/events/${eventId}/teams`;
  if (target === 'attendance_operations' && eventId) return `/events/${eventId}/attendance`;
  if (target === 'admin_queues') return `/admin/queues`;
  if (target === 'admin_users' && userId) return `/admin/users/${userId}`;
  if (target === 'admin_audit') return `/admin/audit-logs`;

  // 2. Derive based on type and entity_ids
  const type = notification.type;
  
  // Teams
  if (
    [
      'TEAM_REGISTERED', 
      'TEAM_WAITLISTED', 
      'TEAM_CANCELLED', 
      'TEAM_LEADERSHIP_TRANSFERRED', 
      'TEAM_MEMBER_REMOVED', 
      'TEAM_WAITLIST_PROMOTED',
      'TEAM_INVITATION_RECEIVED',
      'TEAM_INVITATION_ACCEPTED',
      'TEAM_INVITATION_DECLINED'
    ].includes(type)
  ) {
    if (eventId) return `/events/${eventId}/teams`;
  }

  // Attendance
  if (
    ['ATTENDANCE_DISPUTE_RESOLVED', 'ATTENDANCE_ALERT'].includes(type)
  ) {
    if (eventId) return `/events/${eventId}/attendance`;
  }

  // Admin/System
  if (type === 'ROLE_CHANGED' && userId) {
    return `/admin/users/${userId}`;
  }

  // Events (Default for Event Lifecycle)
  if (
    ['APPROVAL_REQUEST', 'EVENT_APPROVED', 'EVENT_REJECTED', 'EVENT_REMINDER', 'WAITLIST_PROMOTED'].includes(type)
  ) {
    if (eventId) return `/events/${eventId}`;
  }

  // 3. Fallback target from routing metadata
  if (routing.fallback) {
    // If the backend actually sent a URL path in fallback
    if (routing.fallback.startsWith('/')) return routing.fallback;
  }

  // Insufficient metadata -> Informational (no link)
  return null;
}

export function getNotificationIcon(type: string): React.ReactNode {
  switch (type) {
    case 'EVENT_APPROVED':
    case 'WAITLIST_PROMOTED':
    case 'TEAM_INVITATION_ACCEPTED':
      return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
    
    case 'APPROVAL_REQUEST':
    case 'EVENT_REJECTED':
    case 'EVENT_REMINDER':
    case 'CLUB_ANNOUNCEMENT':
      return <CalendarOutlined style={{ color: '#1677ff' }} />;
      
    case 'TEAM_REGISTERED':
    case 'TEAM_WAITLISTED':
    case 'TEAM_CANCELLED':
    case 'TEAM_INVITATION_RECEIVED':
    case 'TEAM_INVITATION_DECLINED':
    case 'TEAM_LEADERSHIP_TRANSFERRED':
    case 'TEAM_MEMBER_REMOVED':
    case 'TEAM_WAITLIST_PROMOTED':
      return <TeamOutlined style={{ color: '#722ed1' }} />;
      
    case 'ATTENDANCE_DISPUTE_RESOLVED':
    case 'ATTENDANCE_ALERT':
      return <ClockCircleOutlined style={{ color: '#fa8c16' }} />;
      
    case 'ROLE_CHANGED':
    case 'SYSTEM_ALERT':
      return <MonitorOutlined style={{ color: '#eb2f96' }} />;
      
    default:
      return <InfoCircleOutlined style={{ color: '#1677ff' }} />;
  }
}
