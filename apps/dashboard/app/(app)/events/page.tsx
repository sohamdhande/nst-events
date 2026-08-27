'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { 
  Card, Empty, Alert, Typography, Tag, Space, Button, 
  Input, Select, Table, Grid, theme, Flex, Dropdown, MenuProps, Modal
} from 'antd';
import { 
  ReloadOutlined, MoreOutlined
} from '@ant-design/icons';
import { canManageEvent, canApproveEvent, canLockEvent, isPlatformAdmin, isFacultyAdmin } from '../../../lib/auth-helpers';
import { resolveEventLockState } from '../../../lib/event-utils';
import { useEvents, Event } from '../../../hooks/useEvents';
import { useClubs } from '../../../hooks/useClubs';
import { useCurrentUser } from '../../../hooks/useCurrentUser';
import { useEventLifecycle } from '../../../hooks/useEventLifecycle';

import { useSearchParams, useRouter, usePathname } from 'next/navigation';

const { Title, Text } = Typography;
const { useToken } = theme;
const { useBreakpoint } = Grid;

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

export default function EventsPage() {
  const { token } = useToken();
  const screens = useBreakpoint();
  const isMobile = !screens.md;

  const { data: currentUser } = useCurrentUser();
  const hasPlatformAdminRole = currentUser?.global_role === 'PLATFORM_ADMIN';
  const hasFacultyAdminRole = currentUser?.global_role === 'FACULTY_ADMIN';
  const hasClubAdminRole = currentUser?.club_memberships?.some(
    m => m.role === 'CLUB_ADMIN' || m.role === 'CORE_MEMBER'
  );
  const canCreateEvent = hasPlatformAdminRole || hasFacultyAdminRole || hasClubAdminRole;

  // Filter State (URL as source of truth)
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const searchQuery = searchParams.get('q') || '';
  const filterState = searchParams.get('filter_state') || undefined;
  const filterClubId = searchParams.get('filter_club_id') || undefined;

  const [localSearch, setLocalSearch] = useState(searchQuery);

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocalSearch(searchQuery);
  }, [searchQuery]);

  const updateFilters = (updates: Record<string, string | undefined>, action: 'push' | 'replace' = 'push') => {
    const newParams = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([key, value]) => {
      if (value) {
        newParams.set(key, value);
      } else {
        newParams.delete(key);
      }
    });
    newParams.delete('cursor'); // Reset cursor on filter change
    
    const url = `${pathname}${newParams.toString() ? '?' + newParams.toString() : ''}`;
    if (action === 'replace') {
      router.replace(url);
    } else {
      router.push(url);
    }
  };

  // Queries
  const { data, isLoading, isError, refetch, isFetching } = useEvents({
    q: searchQuery || undefined,
    filter_state: filterState,
    filter_club_id: filterClubId,
  });

  const { data: clubsData, isLoading: isLoadingClubs } = useClubs();

  // Mutations
  const { submitMutation, approveMutation, rejectMutation, lockMutation, unlockMutation } = useEventLifecycle();

  const handleResetFilters = () => {
    router.push(pathname);
  };

  const handleClearClubFilter = (e?: React.MouseEvent<HTMLElement>) => {
    e?.preventDefault();
    updateFilters({ filter_club_id: undefined });
  };

  const hasActiveFilters = Boolean(searchQuery || filterState || filterClubId);

  // Authorization helper
  const getActionAuth = (event: Event) => {
    let isGlobalAdmin = false;
    let isClubAdmin = false;
    let isMentor = false;
    let isCoreMember = false;

    if (currentUser && event) {
      if (isPlatformAdmin(currentUser) || isFacultyAdmin(currentUser)) {
        isGlobalAdmin = true;
      }
      
      const primaryClubId = event.eventClubs?.find((ec) => ec.isPrimary)?.club.id;
      if (primaryClubId) {
        const primaryRole = currentUser.club_memberships.find(m => m.club_id === primaryClubId)?.role;
        isClubAdmin = primaryRole === 'CLUB_ADMIN';
        isCoreMember = primaryRole === 'CORE_MEMBER';
        isMentor = primaryRole === 'FACULTY_MENTOR';
      }
    }

    const canManageRegistrations = isGlobalAdmin || isClubAdmin || isCoreMember || isMentor;
    const canManageTeams = canManageRegistrations && event.registrationType === 'TEAM';
    const canManageAttendance = isGlobalAdmin || isClubAdmin || isCoreMember || isMentor;
    const eventParam = event as unknown as Parameters<typeof canManageEvent>[1];
    const canEdit = canManageEvent(currentUser, eventParam) && event.state === 'DRAFT';
    const canSubmit = canManageEvent(currentUser, eventParam) && event.state === 'DRAFT';
    const canApprove = canApproveEvent(currentUser, eventParam) && event.state === 'PENDING_APPROVAL';
    const canReject = canApproveEvent(currentUser, eventParam) && event.state === 'PENDING_APPROVAL';
    
    // For locks, rely on existing operations check
    const canLock = canLockEvent(currentUser, eventParam) && event.state === 'PUBLISHED';
    const canUnlock = canLockEvent(currentUser, eventParam) && event.state === 'PUBLISHED';

    return {
      canManageRegistrations,
      canManageTeams,
      canManageAttendance,
      canEdit,
      canSubmit,
      canApprove,
      canReject,
      canLock,
      canUnlock
    };
  };

  const getActionMenu = (record: Event): MenuProps['items'] => {
    const auth = getActionAuth(record);
    const lockState = resolveEventLockState(record);

    const items: MenuProps['items'] = [
      {
        key: 'view',
        label: <Link href={`/events/${record.id}`}>View</Link>,
      }
    ];

    const lifecycleItems: MenuProps['items'] = [];
    if (auth.canEdit && lockState === 'UNLOCKED') {
      lifecycleItems.push({
        key: 'edit',
        label: <Link href={`/events/${record.id}/edit`}>Edit</Link>,
      });
    }
    if (auth.canSubmit && lockState === 'UNLOCKED') {
      lifecycleItems.push({
        key: 'submit',
        label: 'Submit for Approval',
        onClick: () => submitMutation.mutate(record.id),
      });
    }
    if (auth.canApprove && lockState === 'UNLOCKED') {
      lifecycleItems.push({
        key: 'approve',
        label: 'Approve',
        onClick: () => approveMutation.mutate(record.id),
      });
    }
    if (auth.canReject && lockState === 'UNLOCKED') {
      lifecycleItems.push({
        key: 'reject',
        label: 'Reject',
        onClick: () => {
          Modal.confirm({
            title: 'Reject Event',
            content: 'Are you sure you want to reject this event?',
            onOk: () => rejectMutation.mutate({ eventId: record.id, reason: 'Rejected from Directory' }),
          });
        },
      });
    }
    if (auth.canLock && lockState === 'UNLOCKED') {
      lifecycleItems.push({
        key: 'lock',
        label: 'Lock',
        onClick: () => lockMutation.mutate(record.id),
      });
    }
    if (auth.canUnlock && lockState === 'MANUALLY_LOCKED') {
      lifecycleItems.push({
        key: 'unlock',
        label: 'Unlock',
        onClick: () => unlockMutation.mutate(record.id),
      });
    }

    if (lifecycleItems.length > 0) {
      items.push({ type: 'divider' });
      items.push(...lifecycleItems);
    }

    const operationsItems: MenuProps['items'] = [];
    if (auth.canManageRegistrations) {
      operationsItems.push({
        key: 'manage-registrations',
        label: <Link href={`/events/${record.id}/registrations`}>Manage Registrations</Link>,
      });
    }
    if (auth.canManageTeams) {
      operationsItems.push({
        key: 'manage-teams',
        label: <Link href={`/events/${record.id}/teams`}>Manage Teams</Link>,
      });
    }
    if (auth.canManageAttendance) {
      operationsItems.push({
        key: 'attendance',
        label: <Link href={`/events/${record.id}/attendance`}>Attendance</Link>,
      });
    }

    if (operationsItems.length > 0) {
      items.push({ type: 'divider' });
      items.push(...operationsItems);
    }

    return items;
  };

  const columns = [
    {
      title: 'Event',
      dataIndex: 'title',
      key: 'title',
      render: (text: string, record: Event) => (
        <Space orientation="vertical" size={0}>
          <Link href={`/events/${record.id}`}>
            <Text strong style={{ color: token.colorPrimary }}>{text}</Text>
          </Link>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.eventType?.toUpperCase() || 'OTHER'} &middot; {record.visibility?.toUpperCase() || 'PUBLIC'}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'state',
      key: 'state',
      render: (state: string) => {
        let label = state.replace('_', ' ');
        if (state === 'PENDING_APPROVAL') label = 'Pending Approval';
        return (
          <Tag color={getStatusTagColor(state)} style={{ margin: 0 }}>
            {label}
          </Tag>
        );
      },
    },
    {
      title: 'Date / Time',
      key: 'datetime',
      render: (_: unknown, record: Event) => {
        const start = new Date(record.startTime).toLocaleString(undefined, {
          month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
        });
        return (
          <Text>{start}</Text>
        );
      },
    },
    {
      title: 'Audience',
      key: 'audience',
      render: (_: unknown, record: Event) => {
        if (record.audience === 'ALL_STUDENTS') {
          return <Text>All Students</Text>;
        }
        const batchCount = record.audienceBatchIds?.length || 0;
        return <Text>{batchCount} {batchCount === 1 ? 'batch' : 'batches'}</Text>;
      },
    },
    {
      title: 'Club',
      key: 'organizer',
      render: (_: unknown, record: Event) => {
        const primaryClub = record.eventClubs?.find(c => c.isPrimary)?.club;
        const additional = record.eventClubs ? record.eventClubs.length - 1 : 0;
        return (
          <Space orientation="vertical" size={0}>
            <Text>{primaryClub?.name || '-'}</Text>
            {additional > 0 && <Text type="secondary" style={{ fontSize: 12 }}>+{additional} clubs</Text>}
          </Space>
        );
      },
    },
    {
      title: 'Registration',
      key: 'capacity',
      render: (_: unknown, record: Event) => {
        const regStatus = record.state === 'PUBLISHED' 
          ? (record.maxCapacity !== null && record.registrationCount >= record.maxCapacity ? 'FULL' : 'OPEN')
          : 'CLOSED';
        return (
          <Space orientation="vertical" size={0}>
            <Text>
              {record.registrationCount} / {record.maxCapacity ?? '∞'}
            </Text>
            <Text type="secondary" style={{ fontSize: 12 }}>{regStatus}</Text>
            {record.below_minimum_team_count && record.below_minimum_team_count > 0 ? (
              <Tag color="warning" style={{ margin: '4px 0 0 0', fontSize: 11 }}>
                {record.below_minimum_team_count} team{record.below_minimum_team_count === 1 ? '' : 's'} below min
              </Tag>
            ) : null}
          </Space>
        );
      },
    },
    {
      title: 'Lock',
      key: 'lock',
      render: (_: unknown, record: Event) => {
        const lockState = resolveEventLockState(record);
        return <Text type={lockState !== 'UNLOCKED' ? 'secondary' : undefined}>{lockState.replace('_', ' ')}</Text>;
      }
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: unknown, record: Event) => (
        <Dropdown menu={{ items: getActionMenu(record) }} trigger={['click']}>
          <Button type="text" icon={<MoreOutlined />} />
        </Dropdown>
      ),
    },
  ];

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <Title level={2} style={{ margin: 0 }}>Events</Title>
          <Text type="secondary">Manage event lifecycle, registration, teams, and attendance.</Text>
          {filterClubId && (
            <div style={{ marginTop: 8 }}>
              <Tag 
                closable 
                onClose={handleClearClubFilter}
                style={{ padding: '4px 8px', fontSize: 13, display: 'inline-flex', alignItems: 'center' }}
              >
                Showing events organized by {clubsData?.data?.find(c => c.id === filterClubId)?.name || 'selected club'}
              </Tag>
            </div>
          )}
        </div>
        {canCreateEvent && (
          <Link href="/events/create">
            <Button type="primary">Create Event</Button>
          </Link>
        )}
      </div>

      {/* Toolbar */}
      <Card 
        styles={{ body: { padding: 16 } }} 
        variant="borderless"
      >
        <Flex 
          vertical={isMobile} 
          gap="middle" 
          wrap="wrap"
          style={{ width: '100%' }}
        >
          <Input.Search
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            placeholder="Search events..."
            allowClear
            onSearch={(val) => updateFilters({ q: val || undefined }, 'replace')}
            style={{ width: isMobile ? '100%' : 250 }}
          />
          
          <Select
            placeholder="Status"
            allowClear
            style={{ width: isMobile ? '100%' : 160 }}
            value={filterState}
            onChange={(val) => updateFilters({ filter_state: val || undefined })}
            options={[
              { label: 'Draft', value: 'DRAFT' },
              { label: 'Pending Approval', value: 'PENDING_APPROVAL' },
              { label: 'Published', value: 'PUBLISHED' },
              { label: 'Rejected', value: 'REJECTED' },
              { label: 'Archived', value: 'ARCHIVED' },
            ]}
          />

          <Select
            placeholder="Club / Organizer"
            allowClear
            showSearch
            style={{ width: isMobile ? '100%' : 220 }}
            value={filterClubId}
            onChange={(val) => updateFilters({ filter_club_id: val || undefined })}
            loading={isLoadingClubs}
            filterOption={(input, option) => 
              (option?.label ?? '').toString().toLowerCase().includes(input.toLowerCase())
            }
            options={clubsData?.data?.map(c => ({ label: c.name, value: c.id })) || []}
          />

          {hasActiveFilters && (
            <Button 
              icon={<ReloadOutlined />} 
              onClick={handleResetFilters}
              block={isMobile}
            >
              Clear filters
            </Button>
          )}
        </Flex>
      </Card>

      {/* Content */}
      {isError ? (
        <Alert
          title="Failed to load events"
          description="We couldn't retrieve the events list at this time."
          type="error"
          showIcon
          action={
            <Button size="small" danger onClick={() => refetch()}>
              Retry
            </Button>
          }
        />
      ) : (
        <Card variant="borderless" styles={{ body: { padding: isMobile ? 12 : 0 } }}>
          {isMobile ? (
            isLoading ? (
              <Flex vertical gap="middle">
                {[1, 2, 3].map(i => <Card key={i} loading />)}
              </Flex>
            ) : (!data?.data || data.data.length === 0) ? (
              <Empty 
                description={hasActiveFilters ? "No events match your filters." : "No events yet."} 
              >
                {hasActiveFilters && (
                  <Button onClick={handleResetFilters}>Clear filters</Button>
                )}
              </Empty>
            ) : (
              <Flex vertical gap="middle">
                {data.data.map((record) => {
                  const primaryClub = record.eventClubs?.find(c => c.isPrimary)?.club;
                  return (
                    <Card 
                      key={record.id}
                      style={{ width: '100%', borderColor: token.colorBorderSecondary }} 
                      styles={{ body: { padding: 16 } }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                        <Space orientation="vertical" size={0}>
                          <Link href={`/events/${record.id}`}>
                            <Title level={5} style={{ margin: 0, color: token.colorPrimary }}>{record.title}</Title>
                          </Link>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {record.eventType?.toUpperCase() || 'OTHER'} &middot; {record.visibility?.toUpperCase() || 'PUBLIC'}
                          </Text>
                        </Space>
                        <Dropdown menu={{ items: getActionMenu(record) }} trigger={['click']}>
                          <Button type="text" icon={<MoreOutlined />} />
                        </Dropdown>
                      </div>
                      
                      <Space orientation="vertical" size="small" style={{ width: '100%' }}>
                        <Tag color={getStatusTagColor(record.state)} style={{ margin: 0 }}>
                          {record.state.replace('_', ' ')}
                        </Tag>

                        <Text>{new Date(record.startTime).toLocaleString(undefined, {
                            month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
                        })}</Text>
                        
                        <Text>{primaryClub?.name || '-'}</Text>

                        {record.audience === 'ALL_STUDENTS' ? (
                          <Text type="secondary">Audience: All Students</Text>
                        ) : (
                          <Text type="secondary">Audience: {record.audienceBatchIds?.length || 0} batches</Text>
                        )}
                        
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, paddingTop: 12, borderTop: `1px solid ${token.colorBorderSecondary}` }}>
                          <Space orientation="vertical" size={0}>
                            <Text>
                              {record.registrationCount} / {record.maxCapacity ?? '∞'} Registered
                            </Text>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              {record.state === 'PUBLISHED' ? (record.maxCapacity !== null && record.registrationCount >= record.maxCapacity ? 'FULL' : 'OPEN') : 'CLOSED'}
                            </Text>
                          </Space>
                        </div>
                      </Space>
                    </Card>
                  );
                })}
              </Flex>
            )
          ) : (
            <>
              <Table
                columns={columns}
                dataSource={data?.data || []}
                rowKey="id"
                loading={isLoading || isFetching}
                pagination={false}
                size="small"
                locale={{
                  emptyText: (
                    <Empty 
                      description={hasActiveFilters ? "No events match your filters." : "No events yet."} 
                    >
                      {hasActiveFilters && (
                        <Button onClick={handleResetFilters}>Clear filters</Button>
                      )}
                    </Empty>
                  )
                }}
              />
              {data?.pagination?.has_more && (
                <div style={{ textAlign: 'center', padding: '16px 0' }}>
                  <Text type="secondary">More available</Text>
                </div>
              )}
            </>
          )}
        </Card>
      )}
    </div>
  );
}
