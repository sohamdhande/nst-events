'use client';

import { use, useMemo, useState } from 'react';
import Link from 'next/link';
import { notFound, useSearchParams, useRouter, usePathname } from 'next/navigation';
import { Skeleton, Alert, Typography, Tag, Space, Button, Breadcrumb, theme, Popconfirm, Input, Table, Dropdown, MenuProps, App, Select, Drawer, Tabs } from 'antd';
import { MoreOutlined, RightOutlined, TeamOutlined, CalendarOutlined } from '@ant-design/icons';

import { useClubDetail, ClubMember, useRemoveClubMember } from '../../../../hooks/useClubDetail';
import { useUpdateClubStatus } from '../../../../hooks/useUpdateClub';
import { useCurrentUser } from '../../../../hooks/useCurrentUser';
import { EditClubModal } from '../EditClubModal';
import AddMemberModal from './AddMemberModal';
import ChangeRoleModal from './ChangeRoleModal';

const { Title, Text, Paragraph } = Typography;

export default function ClubDetailPage({ params }: { params: Promise<{ clubId: string }> }) {
  const unwrappedParams = use(params);
  const clubId = unwrappedParams.clubId;
  const { token } = theme.useToken();

  const { data: club, isLoading, isError, error, refetch } = useClubDetail(clubId);
  const { data: currentUser } = useCurrentUser();
  const { message } = App.useApp();
  
  const removeMemberMutation = useRemoveClubMember(clubId);
  const updateStatusMutation = useUpdateClubStatus();

  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [addMemberModalOpen, setAddMemberModalOpen] = useState(false);
  const [changeRoleModalOpen, setChangeRoleModalOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<ClubMember | null>(null);
  
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [memberRoleFilter, setMemberRoleFilter] = useState<string>('ALL');
  const [viewMemberDrawerOpen, setViewMemberDrawerOpen] = useState(false);

  const activeTab = searchParams.get('tab') || 'overview';
  const validTabs = ['overview', 'members', 'events', 'administration'];
  const currentTab = validTabs.includes(activeTab) ? activeTab : 'overview';

  const auth = useMemo(() => {
    let isGlobalAdmin = false;
    let isClubAdmin = false;
    let isFacultyMentor = false;

    if (currentUser && club) {
      if (currentUser.global_role === 'PLATFORM_ADMIN' || currentUser.global_role === 'FACULTY_ADMIN') {
        isGlobalAdmin = true;
      }
      
      const membership = club.members.find(m => m.user_id === currentUser.id);
      if (membership) {
        if (membership.role === 'CLUB_ADMIN') isClubAdmin = true;
        if (membership.role === 'FACULTY_MENTOR') isFacultyMentor = true;
      }
    }

    const canEditClub = isGlobalAdmin || isClubAdmin;
    const canChangeStatus = currentUser?.global_role === 'PLATFORM_ADMIN';
    const canAddMember = isGlobalAdmin || isClubAdmin;
    const canRemoveMember = isGlobalAdmin || isClubAdmin;
    const canChangeMemberRole = isGlobalAdmin || isClubAdmin || isFacultyMentor;

    return {
      isGlobalAdmin,
      isClubAdmin,
      canEditClub,
      canChangeStatus,
      canAddMember,
      canRemoveMember,
      canChangeMemberRole,
    };
  }, [currentUser, club]);

  const filteredMembers = useMemo(() => {
    if (!club) return [];
    let result = club.members;
    if (memberSearchQuery) {
      const q = memberSearchQuery.toLowerCase();
      result = result.filter(m => m.full_name.toLowerCase().includes(q));
    }
    if (memberRoleFilter !== 'ALL') {
      result = result.filter(m => m.role === memberRoleFilter);
    }
    
    const roleWeight = (role: string) => {
      switch (role) {
        case 'CLUB_ADMIN': return 0;
        case 'FACULTY_MENTOR': return 1;
        case 'CORE_MEMBER': return 1;
        case 'MEMBER': return 2;
        default: return 3;
      }
    };
    
    return [...result].sort((a, b) => {
      const weightDiff = roleWeight(a.role) - roleWeight(b.role);
      if (weightDiff !== 0) return weightDiff;
      return a.full_name.localeCompare(b.full_name);
    });
  }, [club, memberSearchQuery, memberRoleFilter]);

  // ── Loading ──
  if (isLoading) {
    return (
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 32px' }}>
        <Skeleton active paragraph={{ rows: 2 }} style={{ marginBottom: 24 }} />
        <Skeleton active paragraph={{ rows: 8 }} />
      </div>
    );
  }

  // ── Error states ──
  if (isError) {
    if ((error as Error)?.message?.includes('404')) {
      notFound();
    }
    if ((error as Error)?.message?.includes('403')) {
      return (
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 32px' }}>
          <Alert
            title="Access Denied"
            description="You do not have access to this club."
            type="error"
            showIcon
          />
        </div>
      );
    }
    return (
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 32px' }}>
        <Alert
          title="Unable to load club"
          description="We couldn't retrieve this club's information."
          type="error"
          showIcon
          action={<Button size="small" danger onClick={() => refetch()}>Retry</Button>}
        />
      </div>
    );
  }

  if (!club) return null;

  // ── Helpers ──
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'success';
      case 'INACTIVE': return 'warning';
      case 'DISSOLVED': return 'error';
      default: return 'default';
    }
  };

  const getStatusDotColor = (status: string) => {
    switch (status) {
      case 'ACTIVE': return token.colorSuccess;
      case 'INACTIVE': return token.colorWarning;
      case 'DISSOLVED': return token.colorError;
      default: return token.colorTextDisabled;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'CLUB_ADMIN': return 'geekblue';
      case 'CORE_MEMBER': return 'cyan';
      case 'FACULTY_MENTOR': return 'purple';
      case 'MEMBER': return 'default';
      default: return 'default';
    }
  };

  const formatRole = (role: string) => {
    switch (role) {
      case 'CLUB_ADMIN': return 'Club Admin';
      case 'CORE_MEMBER': return 'Core Member';
      case 'FACULTY_MENTOR': return 'Faculty Mentor';
      case 'MEMBER': return 'Member';
      default: return role;
    }
  };

  const openChangeRole = (member: ClubMember) => {
    setSelectedMember(member);
    setChangeRoleModalOpen(true);
  };

  const openViewMember = (member: ClubMember) => {
    setSelectedMember(member);
    setViewMemberDrawerOpen(true);
  };

  const clubInitials = club.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'C';

  // ── Shared surface style ──
  const surfaceStyle: React.CSSProperties = {
    backgroundColor: token.colorBgContainer,
    border: `1px solid ${token.colorBorderSecondary}`,
    borderRadius: 6,
  };

  // ═══════════════════════════════════════
  // OVERVIEW TAB
  // ═══════════════════════════════════════
  const renderOverview = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* KPI Cards Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        <div style={{ ...surfaceStyle, padding: '20px 24px' }}>
          <Text type="secondary" style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 8 }}>Total Members</Text>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <Text strong style={{ fontSize: 24, lineHeight: 1 }}>{club.members.length}</Text>
            <Text type="secondary" style={{ fontSize: 13 }}>active</Text>
          </div>
        </div>
        <div style={{ ...surfaceStyle, padding: '20px 24px' }}>
          <Text type="secondary" style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 8 }}>Total Events</Text>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <Text strong style={{ fontSize: 24, lineHeight: 1 }}>{club.event_count}</Text>
            <Text type="secondary" style={{ fontSize: 13 }}>recorded</Text>
          </div>
        </div>
        <div style={{ ...surfaceStyle, padding: '20px 24px' }}>
          <Text type="secondary" style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 8 }}>Current Status</Text>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: getStatusDotColor(club.status) }} />
            <Text strong style={{ fontSize: 16 }}>{club.status.charAt(0) + club.status.slice(1).toLowerCase()}</Text>
          </div>
        </div>
      </div>

      {/* Two-column: Club Information + Shortcuts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24, alignItems: 'start' }}>
        {/* Club Information */}
        <div style={{ ...surfaceStyle, padding: '24px' }}>
          <Text strong style={{ fontSize: 16, display: 'block', marginBottom: 20 }}>Club Information</Text>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px 32px' }}>
            <div>
              <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Name</Text>
              <Text strong>{club.name}</Text>
            </div>
            <div>
              <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Status</Text>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: getStatusDotColor(club.status) }} />
                <Text>{club.status.charAt(0) + club.status.slice(1).toLowerCase()}</Text>
              </div>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Description</Text>
              <div style={{ backgroundColor: token.colorFillAlter, borderRadius: 4, padding: '12px 16px', marginTop: 4 }}>
                <Text>{club.description || 'No description provided.'}</Text>
              </div>
            </div>
          </div>
        </div>

        {/* Shortcut Cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Members shortcut */}
          <div style={{ ...surfaceStyle, padding: '20px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <TeamOutlined style={{ fontSize: 16, color: token.colorPrimary }} />
                <Text strong style={{ fontSize: 15 }}>Members</Text>
              </div>
              <Tag style={{ margin: 0, borderRadius: 10, fontSize: 12 }}>{club.members.length}</Tag>
            </div>
            <Text type="secondary" style={{ fontSize: 13, display: 'block', marginBottom: 16 }}>
              Manage roster, roles, and membership statuses for {club.name}.
            </Text>
            <Button type="primary" block onClick={() => router.push(`${pathname}?tab=members`)}>
              View Members <RightOutlined style={{ fontSize: 10 }} />
            </Button>
          </div>

          {/* Events shortcut */}
          <div style={{ ...surfaceStyle, padding: '20px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <CalendarOutlined style={{ fontSize: 16, color: token.colorPrimary }} />
                <Text strong style={{ fontSize: 15 }}>Events</Text>
              </div>
              <Tag style={{ margin: 0, borderRadius: 10, fontSize: 12 }}>{club.event_count}</Tag>
            </div>
            <Text type="secondary" style={{ fontSize: 13, display: 'block', marginBottom: 16 }}>
              View historical and upcoming event records for this club.
            </Text>
            <Link href={`/events?filter_club_id=${clubId}`}>
              <Button block>
                View Events <RightOutlined style={{ fontSize: 10 }} />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );

  // ═══════════════════════════════════════
  // MEMBERS TAB
  // ═══════════════════════════════════════
  const renderMembers = () => (
    <section>
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0, fontSize: 18, marginBottom: 4 }}>Members · {club.members.length}</Title>
        <Text type="secondary" style={{ fontSize: 14 }}>Manage members and Club roles.</Text>
      </div>

      {/* Toolbar */}
      <div style={{
        ...surfaceStyle,
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        marginBottom: 12,
      }}>
        <Input.Search
          placeholder="Search members..."
          allowClear
          onChange={e => setMemberSearchQuery(e.target.value)}
          style={{ maxWidth: 400, flex: 1 }}
        />
        <Space>
          <Select
            value={memberRoleFilter}
            onChange={setMemberRoleFilter}
            style={{ width: 140 }}
            options={[
              { value: 'ALL', label: 'All Roles' },
              { value: 'CLUB_ADMIN', label: 'Club Admin' },
              { value: 'FACULTY_MENTOR', label: 'Faculty Mentor' },
              { value: 'CORE_MEMBER', label: 'Core Member' },
              { value: 'MEMBER', label: 'Member' },
            ]}
          />
          {auth.canAddMember && (
            <Button onClick={() => setAddMemberModalOpen(true)}>+ Add Member</Button>
          )}
        </Space>
      </div>

      {/* Table */}
      <Table
        size="middle"
        dataSource={filteredMembers}
        rowKey="user_id"
        pagination={false}
        locale={{ emptyText: (memberSearchQuery || memberRoleFilter !== 'ALL') ? "No members match your current filters." : "No members yet. Add members to start managing this club." }}
        style={{
          ...surfaceStyle,
          overflow: 'hidden',
        }}
      >
        <Table.Column
          title={<Text type="secondary" style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Member</Text>}
          key="member"
          render={(_, record: ClubMember) => (
            <Space size="middle">
              {record.avatar_url ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={record.avatar_url} alt="avatar" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }} />
              ) : (
                <div style={{ width: 36, height: 36, borderRadius: '50%', backgroundColor: token.colorFillAlter, border: `1px solid ${token.colorBorderSecondary}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Text type="secondary" style={{ fontSize: 14, fontWeight: 500 }}>
                    {record.full_name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                  </Text>
                </div>
              )}
              <Text strong style={{ fontSize: 14 }}>{record.full_name}</Text>
            </Space>
          )}
        />
        <Table.Column
          title={<Text type="secondary" style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Club Role</Text>}
          key="role"
          dataIndex="role"
          render={(role: string) => (
            <Tag color={getRoleColor(role)} style={{ margin: 0, fontSize: 12, fontWeight: 500 }}>{formatRole(role)}</Tag>
          )}
        />
        <Table.Column
          title={<Text type="secondary" style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', float: 'right' }}>Actions</Text>}
          key="actions"
          align="right"
          width={80}
          render={(_, record: ClubMember) => {
            const items: MenuProps['items'] = [];

            items.push({
              key: 'view',
              label: 'View Member',
              onClick: () => openViewMember(record),
            });

            if (auth.canChangeMemberRole) {
              items.push({
                key: 'change-role',
                label: 'Change Role',
                onClick: () => openChangeRole(record),
              });
            }

            if (auth.canRemoveMember) {
              items.push({ type: 'divider' });
              items.push({
                key: 'remove',
                label: (
                  <Popconfirm
                    title="Remove Member?"
                    description={`This removes ${record.full_name} from ${club.name}. Their platform account is not deleted.`}
                    onConfirm={async () => {
                      try {
                        await removeMemberMutation.mutateAsync(record.user_id);
                        message.success('Member removed');
                      } catch (err: unknown) {
                        if (err instanceof Error) {
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          message.error((err as any)?.data?.error || err.message || 'Failed to remove member');
                        } else {
                          message.error('Failed to remove member');
                        }
                      }
                    }}
                    okText="Remove Member"
                    cancelText="Cancel"
                  >
                    <span style={{ color: token.colorError }}>Remove Member</span>
                  </Popconfirm>
                ),
              });
            }

            return (
              <Dropdown menu={{ items }} trigger={['click']}>
                <Button type="text" size="small" icon={<MoreOutlined />} />
              </Dropdown>
            );
          }}
        />
      </Table>
    </section>
  );

  // ═══════════════════════════════════════
  // EVENTS TAB
  // ═══════════════════════════════════════
  const renderEvents = () => (
    <section>
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <Title level={4} style={{ margin: 0, fontSize: 18 }}>Events</Title>
          <Tag style={{ margin: 0, borderRadius: 4, fontSize: 12 }}>{club.event_count}</Tag>
        </div>
        <Text type="secondary" style={{ fontSize: 14 }}>Events organized by {club.name}.</Text>
      </div>

      {/* Event bridge card */}
      <div style={{
        ...surfaceStyle,
        padding: '48px 32px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
      }}>
        <div style={{
          width: 56,
          height: 56,
          borderRadius: 12,
          backgroundColor: token.colorFillAlter,
          border: `1px solid ${token.colorBorderSecondary}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 20,
        }}>
          <CalendarOutlined style={{ fontSize: 24, color: token.colorPrimary }} />
        </div>
        <Text strong style={{ fontSize: 22, display: 'block', marginBottom: 4 }}>{club.event_count} Total Events</Text>
        <Text type="secondary" style={{ fontSize: 14, display: 'block', marginBottom: 24 }}>Events organized by this club.</Text>
        <Link href={`/events?filter_club_id=${clubId}`}>
          <Button size="large">VIEW EVENTS <RightOutlined style={{ fontSize: 10 }} /></Button>
        </Link>
      </div>
    </section>
  );

  // ═══════════════════════════════════════
  // ADMINISTRATION TAB
  // ═══════════════════════════════════════
  const renderAdministration = () => (
    <section>
      <Title level={4} style={{ margin: 0, fontSize: 18, marginBottom: 16 }}>Club Information</Title>

      <div style={{ ...surfaceStyle, padding: '24px' }}>
        <div style={{ marginBottom: 20 }}>
          <Text type="secondary" style={{ display: 'block', marginBottom: 4, fontSize: 12 }}>Name</Text>
          <Text strong>{club.name}</Text>
        </div>
        <div style={{ marginBottom: 20 }}>
          <Text type="secondary" style={{ display: 'block', marginBottom: 4, fontSize: 12 }}>Description</Text>
          <Text>{club.description || 'No description provided.'}</Text>
        </div>
        <div style={{ marginBottom: 20 }}>
          <Text type="secondary" style={{ display: 'block', marginBottom: 4, fontSize: 12 }}>Banner</Text>
          {club.banner_url ? (
            <a href={club.banner_url} target="_blank" rel="noopener noreferrer" style={{ color: token.colorPrimary }}>View Image</a>
          ) : (
            <Text type="secondary">None</Text>
          )}
        </div>
        <div style={{ marginBottom: 0 }}>
          <Text type="secondary" style={{ display: 'block', marginBottom: 4, fontSize: 12 }}>Status</Text>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Tag color={getStatusColor(club.status)} style={{ margin: 0 }}>{club.status}</Tag>

            {auth.canChangeStatus && (
              <Dropdown menu={{
                items: [
                  { key: 'ACTIVE', label: 'Set to Active' },
                  { key: 'INACTIVE', label: 'Set to Inactive' },
                  { type: 'divider' },
                  { key: 'DISSOLVED', label: <Text type="danger">Dissolve Club</Text> },
                ],
                onClick: async ({ key }) => {
                  if (key === club.status) return;
                  try {
                    await updateStatusMutation.mutateAsync({ id: clubId, payload: { status: key as 'ACTIVE' | 'INACTIVE' | 'DISSOLVED' } });
                    message.success(`Status changed to ${key}`);
                  } catch (err: unknown) {
                    if (err instanceof Error) {
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      message.error((err as any)?.data?.error || err.message || 'Failed to update status');
                    } else {
                      message.error('Failed to update status');
                    }
                  }
                }
              }} trigger={['click']}>
                <Button size="small">Change Status</Button>
              </Dropdown>
            )}
          </div>
        </div>
      </div>

      {auth.canEditClub && (
        <div style={{ marginTop: 24 }}>
          <Button onClick={() => setEditModalOpen(true)}>Edit Club</Button>
        </div>
      )}
    </section>
  );

  // ═══════════════════════════════════════
  // MAIN RENDER
  // ═══════════════════════════════════════
  return (
    <article style={{ maxWidth: 1200, margin: '0 auto', padding: '0 32px', paddingBottom: 64 }}>
      {/* Breadcrumb */}
      <Breadcrumb
        style={{ marginBottom: 16, fontSize: 13 }}
        items={[
          { title: <Link href="/clubs">Clubs</Link> },
          { title: club.name },
        ]}
      />

      {/* ── Compact Club Identity Header ── */}
      <div style={{
        ...surfaceStyle,
        padding: '20px 24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 16,
      }}>
        <Space size="middle" align="center">
          {/* Club Avatar */}
          <div style={{
            width: 64,
            height: 64,
            borderRadius: 8,
            backgroundColor: token.colorPrimaryBg,
            border: `1px solid ${token.colorPrimaryBorder}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Text strong style={{ fontSize: 22, color: token.colorPrimary }}>
              {clubInitials}
            </Text>
          </div>
          {/* Club Identity */}
          <div>
            <Title level={2} style={{ margin: 0, fontSize: 28, fontWeight: 600, lineHeight: 1.2 }}>{club.name}</Title>
            {club.description && (
              <Paragraph type="secondary" style={{ whiteSpace: 'pre-wrap', margin: 0, fontSize: 14, marginTop: 2 }}>
                {club.description}
              </Paragraph>
            )}
            <div style={{ marginTop: 6 }}>
              <Tag color={getStatusColor(club.status)} style={{ margin: 0, fontSize: 12 }}>
                <span style={{ marginRight: 4 }}>●</span>{club.status.charAt(0) + club.status.slice(1).toLowerCase()}
              </Tag>
            </div>
          </div>
        </Space>

        {/* Right: Edit Club */}
        {auth.canEditClub && (
          <Button onClick={() => setEditModalOpen(true)} style={{ flexShrink: 0 }}>Edit Club</Button>
        )}
      </div>

      {/* ── Tabs ── */}
      <Tabs
        activeKey={currentTab}
        onChange={(key) => router.push(`${pathname}?tab=${key}`)}
        style={{ marginTop: 8 }}
        items={[
          { key: 'overview', label: 'Overview', children: renderOverview() },
          { key: 'members', label: 'Members', children: renderMembers() },
          { key: 'events', label: 'Events', children: renderEvents() },
          { key: 'administration', label: 'Administration', children: renderAdministration() },
        ]}
      />

      {/* ── Modals ── */}
      {editModalOpen && (
        <EditClubModal
          open={editModalOpen}
          onClose={() => setEditModalOpen(false)}
          club={club as unknown as React.ComponentProps<typeof EditClubModal>['club']}
        />
      )}

      {addMemberModalOpen && (
        <AddMemberModal
          clubId={clubId}
          isOpen={addMemberModalOpen}
          onClose={() => setAddMemberModalOpen(false)}
        />
      )}

      {changeRoleModalOpen && (
        <ChangeRoleModal
          clubId={clubId}
          member={selectedMember}
          isOpen={changeRoleModalOpen}
          onClose={() => {
            setChangeRoleModalOpen(false);
            setSelectedMember(null);
          }}
        />
      )}

      <Drawer
        title="View Member"
        placement="right"
        onClose={() => {
          setViewMemberDrawerOpen(false);
          setSelectedMember(null);
        }}
        open={viewMemberDrawerOpen}
        size="default"
      >
        {selectedMember && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginTop: 24 }}>
            {selectedMember.avatar_url ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={selectedMember.avatar_url} alt="avatar" style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', marginBottom: 16 }} />
            ) : (
              <div style={{ width: 80, height: 80, borderRadius: '50%', backgroundColor: token.colorFillAlter, border: `1px solid ${token.colorBorderSecondary}`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                <Text type="secondary" style={{ fontSize: 32 }}>{selectedMember.full_name.charAt(0)}</Text>
              </div>
            )}
            <Title level={4} style={{ margin: 0, marginBottom: 4 }}>{selectedMember.full_name}</Title>
            <Tag color={getRoleColor(selectedMember.role)} style={{ margin: 0, marginTop: 8 }}>{formatRole(selectedMember.role)}</Tag>
          </div>
        )}
      </Drawer>
    </article>
  );
}
