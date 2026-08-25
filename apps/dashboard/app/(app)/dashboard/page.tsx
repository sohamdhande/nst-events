'use client';

import Link from 'next/link';
import { Card, Skeleton, Empty, Alert, Typography, Row, Col, Space, Button, Table, Tag, theme, Dropdown, MenuProps, Modal } from 'antd';
import { ExclamationCircleOutlined, ClockCircleOutlined, CalendarOutlined, MoreOutlined } from '@ant-design/icons';
import { useCurrentUser } from '../../../hooks/useCurrentUser';
import { useApprovals } from '../../../hooks/useApprovals';
import { useQueueMonitoringStats } from '../../../hooks/useQueueMonitoring';
import { useAuditLogs } from '../../../hooks/useAuditLogs';
import { useEvents, Event } from '../../../hooks/useEvents';
import { useEventLifecycle } from '../../../hooks/useEventLifecycle';
import { useNotifications, Notification } from '../../../hooks/useNotifications';
import { resolveManagementAction, ManagementAction } from '../../../lib/action-utils';
import { CurrentUser, ClubMembership } from '../../../hooks/useCurrentUser';

const { Title, Text } = Typography;
const { useToken } = theme;

function formatRelativeTime(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (diffInSeconds < 60) return 'just now';
  
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;
  
  const diffInDays = Math.floor(diffInHours / 24);
  return `${diffInDays}d ago`;
}

function getStatusTagColor(state: string) {
  switch (state) {
    case 'PUBLISHED': return 'success';
    case 'PENDING_APPROVAL': return 'warning';
    case 'REJECTED': return 'error';
    case 'DRAFT': return 'default';
    case 'ARCHIVED': return 'default';
    default: return 'default';
  }
}



// ----------------------------------------------------------------------
// SHARED ACTION REQUIRED SECTION
// ----------------------------------------------------------------------
function ActionRequiredSection({ currentUser }: { currentUser: CurrentUser }) {
  const { token } = useToken();
  const { data: eventsData, isLoading: isEventsLoading, isError: isEventsError } = useEvents({ limit: 100 });
  const { data: queueData, isLoading: isQueueLoading, isError: isQueueError } = useQueueMonitoringStats();
  const { data: notifData, isLoading: isNotifLoading, isError: isNotifError } = useNotifications({ filter_read: false });

  const isGlobalAdmin = currentUser?.global_role === 'PLATFORM_ADMIN' || currentUser?.global_role === 'FACULTY_ADMIN';
  const userAdminClubs = currentUser?.club_memberships?.filter((m: ClubMembership) => m.role === 'CLUB_ADMIN').map((m: ClubMembership) => m.club_id) || [];
  const userCoreClubs = currentUser?.club_memberships?.filter((m: ClubMembership) => m.role === 'CORE_MEMBER').map((m: ClubMembership) => m.club_id) || [];
  const userMentorClubs = currentUser?.club_memberships?.filter((m: ClubMembership) => m.role === 'FACULTY_MENTOR').map((m: ClubMembership) => m.club_id) || [];

  const currentUserRoles = { isGlobalAdmin, isMentor: false, isClubAdmin: false, isCoreMember: false };
  
  const actionsMap = new Map<string, ManagementAction>();

  // Process Events
  if (eventsData?.data) {
    eventsData.data.forEach(event => {
      const isMentor = event.eventClubs?.some(ec => userMentorClubs.includes(ec.club.id)) ?? false;
      const isClubAdmin = event.eventClubs?.some(ec => userAdminClubs.includes(ec.club.id)) ?? false;
      const isCoreMember = event.eventClubs?.some(ec => userCoreClubs.includes(ec.club.id)) ?? false;
      
      const roles = { isGlobalAdmin, isMentor, isClubAdmin, isCoreMember };
      const action = resolveManagementAction({ type: 'EVENT', data: event, currentUserRoles: roles });
      
      if (action) {
        actionsMap.set(action.id, action);
      }
    });
  }

  // Process Queues
  if (queueData) {
    const queueAction = resolveManagementAction({ type: 'QUEUE', data: queueData, currentUserRoles });
    if (queueAction) {
      actionsMap.set(queueAction.id, queueAction);
    }
  }

  // Process Notifications
  if (notifData?.pages?.[0]?.data) {
    // Only process the first page of notifications for dashboard actions
    notifData.pages[0].data.forEach((notif: Notification) => {
      const action = resolveManagementAction({ type: 'NOTIFICATION', data: notif, currentUserRoles });
      if (action) {
        // Only set if not already present (Event state deduplication takes precedence)
        if (!actionsMap.has(action.id)) {
          actionsMap.set(action.id, action);
        }
      }
    });
  }

  const actions = Array.from(actionsMap.values());
  actions.sort((a, b) => {
    const priorityWeight = { HIGH: 3, MEDIUM: 2, LOW: 1 };
    if (priorityWeight[a.priority] !== priorityWeight[b.priority]) {
      return priorityWeight[b.priority] - priorityWeight[a.priority];
    }
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });

  const isLoading = isEventsLoading || isQueueLoading || isNotifLoading;
  
  const columns = [
    {
      title: 'Priority',
      key: 'priority',
      width: 100,
      render: (_: unknown, record: ManagementAction) => (
        <Tag color={record.priority === 'HIGH' ? 'error' : record.priority === 'MEDIUM' ? 'warning' : 'default'} style={{ margin: 0, fontSize: 11 }}>
          {record.priority}
        </Tag>
      ),
    },
    {
      title: 'Action',
      key: 'action',
      render: (_: unknown, record: ManagementAction) => (
        <Space direction="vertical" size={0}>
          <Text strong style={{ fontSize: 13, color: token.colorPrimary }}>{record.label}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{record.description}</Text>
        </Space>
      ),
    },
    {
      title: 'Time',
      key: 'time',
      width: 120,
      render: (_: unknown, record: ManagementAction) => (
        <Text type="secondary" style={{ fontSize: 12 }}>{formatRelativeTime(record.timestamp)}</Text>
      ),
    },
    {
      title: '',
      key: 'button',
      width: 160,
      align: 'right' as const,
      render: (_: unknown, record: ManagementAction) => (
        <Link href={record.href}>
          <Button size="small">{record.label}</Button>
        </Link>
      ),
    }
  ];

  return (
    <div>
      <Title level={5} style={{ margin: '0 0 12px 0', fontSize: 14 }}>Action Required</Title>
      
      {/* Error isolation */}
      {(isEventsError || isQueueError || isNotifError) && (
        <Alert 
          message="Some action sources failed to load." 
          type="warning" 
          showIcon 
          style={{ marginBottom: 12 }} 
        />
      )}

      <Card size="small" variant="borderless" styles={{ body: { padding: 0 } }}>
        <Table
          dataSource={actions}
          columns={columns}
          rowKey="id"
          pagination={false}
          loading={isLoading}
          size="small"
          scroll={{ x: true }}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No actions require your attention." style={{ padding: '24px 0' }} /> }}
        />
      </Card>
    </div>
  );
}

function TeamsRequiringAttentionSection({ currentUser }: { currentUser: CurrentUser }) {
  const { token } = useToken();
  const { data: eventsData, isLoading } = useEvents({ limit: 100 });
  
  if (isLoading) {
    return (
      <Card size="small" variant="borderless">
        <Skeleton active paragraph={{ rows: 2 }} />
      </Card>
    );
  }

  // Find all events manageable by user that require attention
  const userAdminClubs = currentUser?.club_memberships?.filter((m: ClubMembership) => m.role === 'CLUB_ADMIN').map((m: ClubMembership) => m.club_id) || [];
  const userCoreClubs = currentUser?.club_memberships?.filter((m: ClubMembership) => m.role === 'CORE_MEMBER').map((m: ClubMembership) => m.club_id) || [];
  const isGlobalAdmin = currentUser?.global_role === 'PLATFORM_ADMIN' || currentUser?.global_role === 'FACULTY_ADMIN';

  const attentionEvents = eventsData?.data?.filter(event => {
    if (!event.below_minimum_team_count || event.below_minimum_team_count === 0) return false;
    
    if (isGlobalAdmin) return true;
    
    // Check if user is organizer
    const isOrganizer = event.eventClubs?.some(ec => 
      userAdminClubs.includes(ec.club.id) || userCoreClubs.includes(ec.club.id)
    );
    
    return isOrganizer;
  }) || [];

  if (attentionEvents.length === 0) {
    return (
      <div>
        <Title level={5} style={{ margin: '0 0 12px 0', fontSize: 14 }}>
          <ExclamationCircleOutlined style={{ marginRight: 8, color: token.colorWarning }} />
          Teams Requiring Attention
        </Title>
        <Card size="small" variant="borderless" style={{ background: token.colorBgContainerDisabled }}>
          <Text type="secondary" style={{ fontSize: 13 }}>No teams currently require attention.</Text>
        </Card>
      </div>
    );
  }

  const columns = [
    {
      title: 'Event',
      key: 'event',
      render: (_: unknown, record: Event) => (
        <Text strong style={{ fontSize: 13 }}>{record.title}</Text>
      ),
    },
    {
      title: 'Affected Teams',
      key: 'teams',
      render: (_: unknown, record: Event) => (
        <Tag color="warning" style={{ margin: 0, fontSize: 12 }}>
          {record.below_minimum_team_count} team{record.below_minimum_team_count === 1 ? '' : 's'} below minimum
        </Tag>
      ),
    },
    {
      title: 'Action',
      key: 'action',
      width: 140,
      align: 'right' as const,
      render: (_: unknown, record: Event) => (
        <Link href={`/events/${record.id}/teams`}>
          <Button type="primary" size="small" style={{ fontSize: 12 }}>
            Manage Teams
          </Button>
        </Link>
      ),
    },
  ];

  return (
    <div>
      <Title level={5} style={{ margin: '0 0 12px 0', fontSize: 14 }}>
        <ExclamationCircleOutlined style={{ marginRight: 8, color: token.colorWarning }} />
        Teams Requiring Attention
      </Title>
      <Card size="small" variant="borderless" styles={{ body: { padding: 0 } }}>
        <Table
          dataSource={attentionEvents}
          columns={columns}
          rowKey="id"
          pagination={false}
          size="small"
          showHeader={false}
        />
      </Card>
    </div>
  );
}

// ----------------------------------------------------------------------
// UNIFIED FACULTY DASHBOARD
// ----------------------------------------------------------------------
export default function DashboardPage() {
  const { token } = useToken();
  const { data: currentUser, isLoading: isUserLoading } = useCurrentUser();
  const { data: eventsData, isLoading: isEventsLoading, isError: isEventsError, refetch: refetchEvents } = useEvents({ limit: 100 });
  const { data: approvalsData, isLoading: isApprovalsLoading } = useApprovals();
  const { data: queueData, isLoading: isQueueLoading } = useQueueMonitoringStats();
  const { submitMutation, approveMutation, rejectMutation, lockMutation, unlockMutation } = useEventLifecycle();
  
  if (isUserLoading) {
    return (
      <div style={{ padding: 16 }}>
        <Skeleton active paragraph={{ rows: 6 }} />
      </div>
    );
  }
  
  if (!currentUser) return null;

  // Authorization checks
  const isGlobalAdmin = currentUser.global_role === 'PLATFORM_ADMIN' || currentUser.global_role === 'FACULTY_ADMIN';
  const isPlatformAdmin = currentUser.global_role === 'PLATFORM_ADMIN';
  const userAdminClubs = currentUser.club_memberships?.filter((m: ClubMembership) => m.role === 'CLUB_ADMIN').map((m: ClubMembership) => m.club_id) || [];
  const userCoreClubs = currentUser.club_memberships?.filter((m: ClubMembership) => m.role === 'CORE_MEMBER').map((m: ClubMembership) => m.club_id) || [];
  const userMentorClubs = currentUser.club_memberships?.filter((m: ClubMembership) => m.role === 'FACULTY_MENTOR').map((m: ClubMembership) => m.club_id) || [];
  const canApprove = isGlobalAdmin || userMentorClubs.length > 0;

  // Top Operational Summary
  const pendingApprovalsCount = approvalsData?.data?.length || 0;
  const deadLettersCount = queueData?.dead_letter_count || 0;
  const failedJobsCount = queueData?.failed_count || 0;
  const isQueueHealthy = deadLettersCount === 0 && failedJobsCount === 0;

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
  const next7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const events = eventsData?.data || [];
  let upcomingEventsCount = 0;
  let teamsRequiringAttentionCount = 0;

  events.forEach(e => {
    const startTime = new Date(e.startTime);
    if (startTime >= now && startTime <= next7Days) upcomingEventsCount++;
    
    if (e.below_minimum_team_count && e.below_minimum_team_count > 0) {
      if (isGlobalAdmin || e.eventClubs?.some(ec => userAdminClubs.includes(ec.club.id) || userCoreClubs.includes(ec.club.id))) {
        teamsRequiringAttentionCount += e.below_minimum_team_count;
      }
    }
  });

  // Action Menu logic
  const getActionMenu = (record: Event): MenuProps['items'] => {
    const isClubAdmin = record.eventClubs?.some(ec => userAdminClubs.includes(ec.club.id)) ?? false;
    const isCoreMember = record.eventClubs?.some(ec => userCoreClubs.includes(ec.club.id)) ?? false;
    const isMentor = record.eventClubs?.some(ec => userMentorClubs.includes(ec.club.id)) ?? false;
    const isEventEditor = isGlobalAdmin || isClubAdmin;

    const canManageRegistrations = isGlobalAdmin || isClubAdmin || isCoreMember || isMentor;
    const canManageTeams = canManageRegistrations && record.registrationType === 'TEAM';
    const canManageAttendance = isGlobalAdmin || isClubAdmin || isCoreMember || isMentor;
    
    const canEdit = isEventEditor && record.state === 'DRAFT';
    const canSubmit = isClubAdmin && record.state === 'DRAFT';
    const canEventApprove = (isGlobalAdmin || isMentor) && record.state === 'PENDING_APPROVAL';
    const canEventReject = (isGlobalAdmin || isMentor) && record.state === 'PENDING_APPROVAL';
    const canLock = (isGlobalAdmin || isClubAdmin || isMentor) && record.state === 'PUBLISHED';
    const canUnlock = (isGlobalAdmin || isClubAdmin || isMentor) && record.state === 'PUBLISHED';

    // DO NOT compute permanent lock from device time per spec. Just use isLocked from backend.
    const isEffectivelyLocked = record.isLocked;

    const items: MenuProps['items'] = [
      { key: 'view', label: <Link href={`/events/${record.id}`}>View Event</Link> }
    ];

    const lifecycleItems: MenuProps['items'] = [];
    if (canEdit && !isEffectivelyLocked) lifecycleItems.push({ key: 'edit', label: <Link href={`/events/${record.id}/edit`}>Edit</Link> });
    if (canSubmit && !isEffectivelyLocked) lifecycleItems.push({ key: 'submit', label: 'Submit for Approval', onClick: () => submitMutation.mutate(record.id) });
    if (canEventApprove && !isEffectivelyLocked) lifecycleItems.push({ key: 'approve', label: 'Approve', onClick: () => approveMutation.mutate(record.id) });
    if (canEventReject && !isEffectivelyLocked) {
      lifecycleItems.push({
        key: 'reject',
        label: 'Reject',
        onClick: () => {
          Modal.confirm({
            title: 'Reject Event',
            content: 'Are you sure you want to reject this event?',
            onOk: () => rejectMutation.mutate({ eventId: record.id, reason: 'Rejected from Dashboard' }), // using existing reason param
          });
        },
      });
    }
    if (canLock && !isEffectivelyLocked && !record.isLocked) lifecycleItems.push({ key: 'lock', label: 'Lock', onClick: () => lockMutation.mutate(record.id) });
    if (canUnlock && record.isLocked) lifecycleItems.push({ key: 'unlock', label: 'Unlock', onClick: () => unlockMutation.mutate(record.id) });

    if (lifecycleItems.length > 0) {
      items.push({ type: 'divider' });
      items.push(...lifecycleItems);
    }

    const operationsItems: MenuProps['items'] = [];
    if (canManageRegistrations) operationsItems.push({ key: 'manage-registrations', label: <Link href={`/events/${record.id}/registrations`}>Manage Registrations</Link> });
    if (canManageTeams) operationsItems.push({ key: 'manage-teams', label: <Link href={`/events/${record.id}/teams`}>Manage Teams</Link> });
    if (canManageAttendance) operationsItems.push({ key: 'attendance', label: <Link href={`/events/${record.id}/attendance`}>Attendance</Link> });

    if (operationsItems.length > 0) {
      items.push({ type: 'divider' });
      items.push(...operationsItems);
    }

    return items;
  };

  // Today's Operations
  const todayEvents = events.filter(e => {
    const startTime = new Date(e.startTime);
    return startTime >= todayStart && startTime < todayEnd;
  }).sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

  // Upcoming Week
  const upcomingEvents = events.filter(e => {
    const startTime = new Date(e.startTime);
    return startTime >= now && startTime <= next7Days;
  }).sort((a, b) => {
    // Priority sort: PENDING_APPROVAL > Near Capacity > Teams Attention > Chronological
    if (a.state === 'PENDING_APPROVAL' && b.state !== 'PENDING_APPROVAL') return -1;
    if (a.state !== 'PENDING_APPROVAL' && b.state === 'PENDING_APPROVAL') return 1;
    
    const aNearCap = a.maxCapacity ? (a.registrationCount / a.maxCapacity) >= 0.9 : false;
    const bNearCap = b.maxCapacity ? (b.registrationCount / b.maxCapacity) >= 0.9 : false;
    if (aNearCap && !bNearCap) return -1;
    if (!aNearCap && bNearCap) return 1;

    const aAttn = (a.below_minimum_team_count || 0) > 0;
    const bAttn = (b.below_minimum_team_count || 0) > 0;
    if (aAttn && !bAttn) return -1;
    if (!aAttn && bAttn) return 1;

    return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
  });

  const sharedColumns = [
    {
      title: 'Time',
      key: 'time',
      render: (_: unknown, record: Event) => {
        const d = new Date(record.startTime);
        return (
          <Space size="small">
            <ClockCircleOutlined style={{ color: token.colorTextSecondary }} />
            <Text style={{ fontSize: 13 }}>
              {d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </Space>
        );
      },
      width: 120,
    },
    {
      title: 'Event',
      dataIndex: 'title',
      key: 'title',
      render: (text: string, record: Event) => (
        <Space orientation="vertical" size={0}>
          <Link href={`/events/${record.id}`}>
            <Text strong style={{ color: token.colorPrimary, fontSize: 13 }}>{text}</Text>
          </Link>
          <Text type="secondary" style={{ fontSize: 11 }}>
            {record.eventType?.replace('_', ' ').toUpperCase() || 'OTHER'}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Location',
      dataIndex: 'locationName',
      key: 'location',
      render: (loc: string | null) => <Text style={{ fontSize: 13 }}>{loc || 'TBA'}</Text>,
    },
    {
      title: 'Registration',
      key: 'capacity',
      render: (_: unknown, record: Event) => (
        <Space orientation="vertical" size={0}>
          <Text style={{ fontSize: 13 }}>
            {record.registrationCount} / {record.maxCapacity ?? '∞'}
          </Text>
          {record.maxCapacity && record.registrationCount >= record.maxCapacity && (
             <Text type="danger" style={{ fontSize: 11 }}>FULL</Text>
          )}
        </Space>
      ),
      width: 120,
    },
    {
      title: 'Status',
      dataIndex: 'state',
      key: 'state',
      render: (state: string) => <Tag color={getStatusTagColor(state)} style={{ margin: 0, fontSize: 11 }}>{state.replace('_', ' ')}</Tag>,
      width: 130,
    },
    {
      title: '',
      key: 'actions',
      width: 50,
      render: (_: unknown, record: Event) => (
        <Dropdown menu={{ items: getActionMenu(record) }} trigger={['click']}>
          <Button type="text" size="small" icon={<MoreOutlined />} />
        </Dropdown>
      ),
    },
  ];

  const upcomingColumns = [
    {
      title: 'Date / Time',
      key: 'datetime',
      render: (_: unknown, record: Event) => (
        <Space size="small">
          <CalendarOutlined style={{ color: token.colorTextSecondary }} />
          <Text style={{ fontSize: 13 }}>
            {new Date(record.startTime).toLocaleString(undefined, {
              month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
            })}
          </Text>
        </Space>
      ),
      width: 160,
    },
    {
      title: 'Event',
      dataIndex: 'title',
      key: 'title',
      render: (text: string, record: Event) => (
        <Space orientation="vertical" size={0}>
          <Link href={`/events/${record.id}`}>
            <Text strong style={{ color: token.colorPrimary, fontSize: 13 }}>{text}</Text>
          </Link>
          <Text type="secondary" style={{ fontSize: 11 }}>
            {record.eventType?.toUpperCase() || 'OTHER'}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Location',
      dataIndex: 'locationName',
      key: 'location',
      render: (loc: string | null) => <Text style={{ fontSize: 13 }}>{loc || 'TBA'}</Text>,
    },
    {
      title: 'Club',
      key: 'club',
      render: (_: unknown, record: Event) => (
        <Text style={{ fontSize: 13 }}>
          {record.eventClubs?.[0]?.club.name || '-'}
        </Text>
      ),
    },
    {
      title: 'Registration',
      key: 'capacity',
      render: (_: unknown, record: Event) => (
        <Space orientation="vertical" size={0}>
          <Text style={{ fontSize: 13 }}>
            {record.registrationCount} / {record.maxCapacity ?? '∞'}
          </Text>
          {record.maxCapacity && record.registrationCount >= record.maxCapacity && (
             <Text type="danger" style={{ fontSize: 11 }}>FULL</Text>
          )}
        </Space>
      ),
      width: 120,
    },
    {
      title: 'Audience',
      key: 'audience',
      render: (_: unknown, record: Event) => (
        <Text style={{ fontSize: 13 }}>
          {record.audience === 'ALL_STUDENTS' ? 'All Students' : `${record.audienceBatchIds?.length || 0} Batches`}
        </Text>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'state',
      key: 'state',
      render: (state: string) => <Tag color={getStatusTagColor(state)} style={{ margin: 0, fontSize: 11 }}>{state.replace('_', ' ')}</Tag>,
      width: 130,
    },
    {
      title: '',
      key: 'actions',
      width: 50,
      render: (_: unknown, record: Event) => (
        <Dropdown menu={{ items: getActionMenu(record) }} trigger={['click']}>
          <Button type="text" size="small" icon={<MoreOutlined />} />
        </Dropdown>
      ),
    },
  ];

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <Title level={4} style={{ margin: 0 }}>Operations Dashboard</Title>
        <Text type="secondary" style={{ fontSize: 13 }}>Institutional management overview</Text>
      </div>

      {isEventsError && (
        <Alert
          message="Failed to load events data"
          type="error"
          showIcon
          action={<Button size="small" danger onClick={() => refetchEvents()}>Retry</Button>}
        />
      )}

      {/* 1. TOP OPERATIONAL SUMMARY STRIP */}
      <Row gutter={[16, 16]}>
        {canApprove && (
          <Col xs={12} md={6}>
            <Link href="/admin/approvals">
              <Card 
                size="small" 
                hoverable 
                styles={{ body: { padding: '16px', display: 'flex', flexDirection: 'column', gap: 4 } }}
                style={{ borderTop: `3px solid ${pendingApprovalsCount > 0 ? token.colorWarning : token.colorSuccess}` }}
              >
                <Text type="secondary" style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pending Approvals</Text>
                <Space align="baseline">
                  <Text strong style={{ fontSize: 24, lineHeight: 1 }}>{isApprovalsLoading ? '-' : pendingApprovalsCount}</Text>
                </Space>
              </Card>
            </Link>
          </Col>
        )}
        <Col xs={12} md={6}>
          <Link href="/events">
            <Card 
              size="small" 
              hoverable 
              styles={{ body: { padding: '16px', display: 'flex', flexDirection: 'column', gap: 4 } }}
              style={{ borderTop: `3px solid ${token.colorPrimary}` }}
            >
              <Text type="secondary" style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Upcoming (7 Days)</Text>
              <Space align="baseline">
                <Text strong style={{ fontSize: 24, lineHeight: 1 }}>{isEventsLoading ? '-' : upcomingEventsCount}</Text>
                <Text type="secondary" style={{ fontSize: 12 }}>from loaded</Text>
              </Space>
            </Card>
          </Link>
        </Col>
        <Col xs={12} md={6}>
          <Card 
            size="small" 
            styles={{ body: { padding: '16px', display: 'flex', flexDirection: 'column', gap: 4 } }}
            style={{ borderTop: `3px solid ${teamsRequiringAttentionCount > 0 ? token.colorError : token.colorSuccess}` }}
          >
            <Text type="secondary" style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Teams Attention</Text>
            <Space align="baseline">
              <Text strong style={{ fontSize: 24, lineHeight: 1 }}>{isEventsLoading ? '-' : teamsRequiringAttentionCount}</Text>
              <Text type="secondary" style={{ fontSize: 12 }}>from loaded</Text>
            </Space>
          </Card>
        </Col>
        {isPlatformAdmin && (
          <Col xs={12} md={6}>
            <Link href="/admin/queues">
              <Card 
                size="small" 
                hoverable 
                styles={{ body: { padding: '16px', display: 'flex', flexDirection: 'column', gap: 4 } }}
                style={{ borderTop: `3px solid ${!isQueueHealthy ? token.colorError : token.colorSuccess}` }}
              >
                <Text type="secondary" style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Queue Health</Text>
                <Space align="baseline">
                  <Text strong style={{ fontSize: 24, lineHeight: 1, color: isQueueHealthy ? token.colorSuccess : token.colorError }}>
                    {isQueueLoading ? '-' : (isQueueHealthy ? 'OK' : 'ERR')}
                  </Text>
                </Space>
              </Card>
            </Link>
          </Col>
        )}
      </Row>

      {/* 2. ACTION REQUIRED */}
      <ActionRequiredSection currentUser={currentUser} />

      {/* 3. TODAY'S OPERATIONS */}
      <div>
        <Title level={5} style={{ margin: '0 0 12px 0', fontSize: 14 }}>
          <ClockCircleOutlined style={{ marginRight: 8 }} />
          Today&apos;s Operations
        </Title>
        <Card size="small" variant="borderless" styles={{ body: { padding: 0 } }}>
          <Table
            dataSource={todayEvents}
            columns={sharedColumns}
            rowKey="id"
            pagination={false}
            loading={isEventsLoading}
            size="small"
            scroll={{ x: true }}
            locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No events scheduled for today from loaded data." style={{ padding: '24px 0' }} /> }}
          />
        </Card>
      </div>

      {/* 4. UPCOMING WEEK */}
      <div>
        <Title level={5} style={{ margin: '0 0 12px 0', fontSize: 14 }}>
          <CalendarOutlined style={{ marginRight: 8 }} />
          Upcoming Operational Schedule (Next 7 Days)
        </Title>
        <Card size="small" variant="borderless" styles={{ body: { padding: 0 } }}>
          <Table
            dataSource={upcomingEvents}
            columns={upcomingColumns}
            rowKey="id"
            pagination={false}
            loading={isEventsLoading}
            size="small"
            scroll={{ x: true }}
            locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No upcoming operational events." style={{ padding: '24px 0' }} /> }}
          />
        </Card>
      </div>

      {/* 5. TEAMS REQUIRING ATTENTION */}
      <TeamsRequiringAttentionSection currentUser={currentUser} />

      {/* 6. RECENT ACTIVITY (Collapsible, Platform Admin Only) */}
      {isPlatformAdmin && (
        <details style={{ background: token.colorBgContainer, borderRadius: token.borderRadius, border: `1px solid ${token.colorBorderSecondary}` }}>
          <summary style={{ padding: '12px 16px', fontWeight: 600, cursor: 'pointer', outline: 'none' }}>
            System Audit Logs
          </summary>
          <div style={{ padding: '0 16px 16px' }}>
            <RecentActivitySection />
          </div>
        </details>
      )}
    </div>
  );
}

function RecentActivitySection() {
  const { data: auditData, isLoading: isAuditLoading, isError: isAuditError } = useAuditLogs();

  const auditColumns = [
    {
      title: 'Time',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (text: string) => <Text type="secondary" style={{ fontSize: 12 }}>{formatRelativeTime(text)}</Text>,
      width: 100,
    },
    {
      title: 'Action',
      dataIndex: 'action',
      key: 'action',
      render: (text: string) => <Text strong style={{ fontSize: 13 }}>{text}</Text>,
    },
    {
      title: 'Actor',
      dataIndex: 'actorId',
      key: 'actorId',
      render: (text: string) => text ? <Text type="secondary" style={{ fontSize: 13 }}>{text.split('-')[0]}...</Text> : '-',
    },
    {
      title: 'Target',
      key: 'target',
      render: (_: unknown, record: { entityType: string; entityId: string | null }) => (
        <Space size="small">
          <Tag variant="filled" style={{ margin: 0, fontSize: 11 }}>{record.entityType}</Tag>
          <Text type="secondary" style={{ fontSize: 12, fontFamily: 'monospace' }}>
            {record.entityId ? record.entityId.split('-')[0] + '...' : '-'}
          </Text>
        </Space>
      ),
    }
  ];

  if (isAuditError) {
    return <Alert message="Failed to load audit logs" type="error" showIcon />;
  }

  return (
    <Table
      dataSource={auditData?.data?.slice(0, 10) || []}
      columns={auditColumns}
      rowKey="id"
      pagination={false}
      loading={isAuditLoading}
      scroll={{ x: true }}
      size="small"
      locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No recent system activity." style={{ padding: '24px 0' }} /> }}
    />
  );
}
