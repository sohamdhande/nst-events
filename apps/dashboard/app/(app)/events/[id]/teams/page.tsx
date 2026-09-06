'use client';

import { use, useMemo } from 'react';
import Link from 'next/link';
import { Card, Button, Alert, Typography, Table, Breadcrumb, Space, Tag, Dropdown, App, Grid, Flex, Empty } from 'antd';
import { LeftOutlined, MoreOutlined } from '@ant-design/icons';
import { useEventDetail } from '../../../../../hooks/useEventDetail';
import { useTeamsList, Team, TeamMember } from '../../../../../hooks/useTeams';
import { useCurrentUser } from '../../../../../hooks/useCurrentUser';
import { useAdminCancelTeam, useAdminRemoveMember, useAdminTransferLeadership, useAdminPromoteWaitlist } from '../../../../../hooks/useAdminTeams';
import { resolveEventLockState } from '../../../../../lib/event-utils';

const { Title, Text } = Typography;
const { useBreakpoint } = Grid;

export default function TeamsManagementPage({ params }: { params: Promise<{ id: string }> }) {
  const { modal, message } = App.useApp();
  const { confirm } = modal;

  const unwrappedParams = use(params);
  const eventId = unwrappedParams.id;
  
  const screens = useBreakpoint();
  const isMobile = !screens.md;

  const { data: event, isLoading: isEventLoading, isError: isEventError, refetch: refetchEvent } = useEventDetail(eventId);
  const { data: currentUser } = useCurrentUser();
  
  const { 
    data, 
    isLoading, 
    isError, 
    fetchNextPage, 
    hasNextPage, 
    isFetchingNextPage,
    refetch: refetchTeams
  } = useTeamsList(eventId);

  const { mutateAsync: cancelTeam } = useAdminCancelTeam(eventId);
  const { mutateAsync: removeMember } = useAdminRemoveMember(eventId);
  const { mutateAsync: transferLeadership } = useAdminTransferLeadership(eventId);
  const { mutateAsync: promoteWaitlist } = useAdminPromoteWaitlist(eventId);


  const teams = useMemo(() => {
    return data?.pages.flatMap(page => page.data) || [];
  }, [data]);

  const lockState = event ? resolveEventLockState(event) : 'UNLOCKED';
  const isEffectivelyLocked = lockState !== 'UNLOCKED';
  
  const isGlobalAdmin = currentUser?.global_role === 'PLATFORM_ADMIN' || currentUser?.global_role === 'FACULTY_ADMIN';
  const isClubAdmin = currentUser?.club_memberships?.some(m => m.role === 'CLUB_ADMIN' && event?.eventClubs?.some(ec => ec.clubId === m.club_id));
  const canManageTeams = Boolean(!isEffectivelyLocked && (isGlobalAdmin || isClubAdmin));

  const capabilities = {
    canViewTeams: true,
    canRemoveMember: canManageTeams,
    canTransferLeadership: canManageTeams,
    canCancelTeam: canManageTeams,
    canPromoteWaitlist: canManageTeams,
  };

  const handleError = (error: unknown, refetch: boolean = true) => {
    const err = error as Error;
    if (err.message.includes('403')) {
      message.error("You do not have permission to perform this action.");
    } else if (err.message.includes('422') && err.message.includes('LOCKED')) {
      message.error("This event is locked. No further modifications can be made.");
      if (refetch) {
        refetchEvent();
        refetchTeams();
      }
    } else {
      message.error(err.message || "An unexpected error occurred.");
    }
  };

  const handleCancelTeam = (teamId: string) => {
    confirm({
      title: 'Cancel this team?',
      content: 'The team will become inactive. If it is registered, released capacity may allow waitlisted teams to be promoted.',
      okText: 'Yes, Cancel Team',
      okType: 'danger',
      cancelText: 'No',
      onOk: async () => {
        try {
          await cancelTeam(teamId);
          message.success('Team cancelled successfully');
        } catch (error) {
          handleError(error);
        }
      }
    });
  };

  const handlePromoteWaitlist = (teamId: string) => {
    confirm({
      title: 'Promote this team?',
      content: 'Are you sure you want to promote this team from the waitlist?',
      okText: 'Yes, Promote',
      cancelText: 'No',
      onOk: async () => {
        try {
          await promoteWaitlist(teamId);
          message.success('Team promoted successfully');
        } catch (error) {
          handleError(error);
        }
      }
    });
  };

  const handleRemoveMember = (teamId: string, member: TeamMember) => {
    confirm({
      title: `Remove ${member.full_name} from this team?`,
      okText: 'Yes, Remove',
      okType: 'danger',
      cancelText: 'No',
      onOk: async () => {
        try {
          await removeMember({ teamId, userId: member.user_id });
          message.success('Member removed successfully');
        } catch (error) {
          handleError(error);
        }
      }
    });
  };

  const handleTransferLeadership = (teamId: string, member: TeamMember) => {
    confirm({
      title: `Transfer leadership to ${member.full_name}?`,
      okText: 'Yes, Transfer',
      cancelText: 'No',
      onOk: async () => {
        try {
          await transferLeadership({ teamId, newLeaderId: member.user_id });
          message.success('Leadership transferred successfully');
        } catch (error) {
          handleError(error);
        }
      }
    });
  };

  if (isEventLoading) {
    return (
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>
        <Card loading variant="borderless" />
      </div>
    );
  }

  if (isEventError || !event) {
    return (
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>
        <Alert title="Error" description="Failed to load event." type="error" />
      </div>
    );
  }

  if (event.registrationType !== 'TEAM') {
    return (
      <div style={{ maxWidth: 600, margin: '100px auto', textAlign: 'center' }}>
        <Space orientation="vertical" size="large">
          <Alert 
            title="Individual Registration Event" 
            description="This event uses individual registration. Team management is not applicable." 
            type="info" 
            showIcon 
          />
          <Link href={`/events/${eventId}`}>
            <Button icon={<LeftOutlined />}>Back to Event</Button>
          </Link>
        </Space>
      </div>
    );
  }

  const metadata = event.metadata as Record<string, unknown> || {};
  const minTeamSize = metadata.minimum_team_size as number | undefined;
  const maxTeamSize = metadata.maximum_team_size as number | undefined;

  const columns = [
    {
      title: 'Team',
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => <Text strong>{text}</Text>
    },
    {
      title: 'Leader',
      dataIndex: 'leader_name',
      key: 'leader',
    },
    {
      title: 'Members',
      key: 'members',
      render: (_: unknown, record: Team) => (
        <Text>{record.member_count} members</Text>
      )
    },
    {
      title: 'Status',
      key: 'registration',
      render: (_: unknown, record: Team) => {
        const status = record.status || 'FORMING';
        let color = 'default';
        if (status === 'REGISTERED') color = 'success';
        if (status === 'WAITLISTED') color = 'warning';
        if (status === 'CANCELLED') color = 'error';
        return <Tag color={color} style={{ margin: 0 }}>{status}</Tag>;
      }
    },
    {
      title: 'Attention',
      key: 'attention',
      render: (_: unknown, record: Team) => {
        const isBelowMin = minTeamSize && record.status === 'REGISTERED' && record.member_count < minTeamSize;
        if (isBelowMin) {
          return <Tag color="warning" style={{ margin: 0 }}>BELOW MINIMUM ({record.member_count} / {minTeamSize})</Tag>;
        }
        if (record.status === 'WAITLISTED') {
          return <Tag color="processing" style={{ margin: 0 }}>WAITLISTED</Tag>;
        }
        return <Text type="secondary">-</Text>;
      }
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: unknown, record: Team) => {
        if (isEffectivelyLocked) return null;
        
        const items = [];
        
        if (capabilities.canCancelTeam && record.status !== 'CANCELLED') {
          items.push({
            key: 'cancel',
            danger: true,
            label: <a onClick={() => handleCancelTeam(record.id)}>Cancel Team</a>
          });
        }
        
        if (capabilities.canPromoteWaitlist && record.status === 'WAITLISTED') {
          items.push({
            key: 'promote',
            label: <a onClick={() => handlePromoteWaitlist(record.id)}>Promote Waitlist</a>
          });
        }

        if (items.length === 0) {
          return null;
        }

        return (
          <Dropdown menu={{ items }} trigger={['click']}>
            <Button type="text" icon={<MoreOutlined />} />
          </Dropdown>
        );
      }
    }
  ];

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <Breadcrumb
        items={[
          { title: <Link href="/events">Events</Link> },
          { title: <Link href={`/events/${eventId}`}>{event.title}</Link> },
          { title: 'Teams' },
        ]}
      />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <Space align="center" wrap>
          <Title level={2} style={{ margin: 0 }}>Teams</Title>
          {lockState === 'MANUALLY_LOCKED' && (
            <Tag color="red" variant="filled" style={{ fontSize: 14, padding: '4px 8px' }}>LOCKED — READ-ONLY</Tag>
          )}
          {lockState === 'PERMANENTLY_LOCKED' && (
            <Tag color="red" variant="filled" style={{ fontSize: 14, padding: '4px 8px' }}>PERMANENTLY LOCKED — READ-ONLY</Tag>
          )}
        </Space>
        <Text type="secondary" style={{ display: 'block', width: '100%' }}>
          Review team composition, registration status, and capacity.
        </Text>
      </div>

      <Card styles={{ body: { padding: 16 } }} variant="borderless">
        <Space separator={<Text type="secondary">|</Text>} wrap>
          <Text strong>Minimum Size: <Text type="secondary" style={{ fontWeight: 'normal' }}>{minTeamSize ?? 'Not set'}</Text></Text>
          <Text strong>Maximum Size: <Text type="secondary" style={{ fontWeight: 'normal' }}>{maxTeamSize ?? 'Not set'}</Text></Text>
        </Space>
      </Card>

      {isError ? (
        <Alert 
          title="Unable to load teams." 
          type="error" 
          showIcon 
          action={<Button size="small" onClick={() => refetchTeams()}>Retry</Button>}
        />
      ) : (
        <Card variant="borderless" styles={{ body: { padding: isMobile ? 12 : 0 } }}>
          {isMobile ? (
             isLoading ? (
               <Flex vertical gap="middle">
                 {[1, 2, 3].map(i => <Card key={i} loading />)}
               </Flex>
             ) : teams.length === 0 ? (
               <Empty description="No teams have been created for this event." />
             ) : (
               <Flex vertical gap="middle">
                 {teams.map((record) => {
                   const isBelowMin = minTeamSize && record.status === 'REGISTERED' && record.member_count < minTeamSize;
                   
                   return (
                     <Card 
                       key={record.id}
                       style={{ width: '100%' }} 
                       styles={{ body: { padding: 16 } }}
                     >
                       <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                         <Text strong>{record.name}</Text>
                         {!isEffectivelyLocked && (
                           <Dropdown menu={{ items: (() => {
                             const items = [];
                             if (capabilities.canCancelTeam && record.status !== 'CANCELLED') {
                               items.push({ key: 'cancel', danger: true, label: <a onClick={() => handleCancelTeam(record.id)}>Cancel Team</a> });
                             }
                             if (capabilities.canPromoteWaitlist && record.status === 'WAITLISTED') {
                               items.push({ key: 'promote', label: <a onClick={() => handlePromoteWaitlist(record.id)}>Promote Waitlist</a> });
                             }
                             return items;
                           })() }} trigger={['click']}>
                             <Button type="text" icon={<MoreOutlined />} />
                           </Dropdown>
                         )}
                       </div>
                       
                       <Space orientation="vertical" size="small" style={{ width: '100%' }}>
                         <Text type="secondary">Leader: {record.leader_name}</Text>
                         <Text type="secondary">{record.member_count} members</Text>
                         
                         <Tag color={record.status === 'REGISTERED' ? 'success' : record.status === 'WAITLISTED' ? 'warning' : record.status === 'CANCELLED' ? 'error' : 'default'} style={{ margin: 0 }}>
                           {record.status || 'FORMING'}
                         </Tag>
                         
                         {isBelowMin && (
                           <Tag color="warning" style={{ margin: 0, marginTop: 4 }}>BELOW MINIMUM ({record.member_count} / {minTeamSize})</Tag>
                         )}
                       </Space>
                     </Card>
                   );
                 })}
               </Flex>
             )
          ) : (
            <Table
              dataSource={teams}
              columns={columns}
              rowKey="id"
              pagination={false}
              loading={isLoading}
              size="small"
              locale={{ emptyText: 'No teams have been created for this event.' }}
              expandable={{
                expandedRowRender: (record: Team) => (
                  <div style={{ margin: '8px 16px' }}>
                    <Text strong style={{ display: 'block', marginBottom: 8, fontSize: 12, color: 'gray', textTransform: 'uppercase' }}>Member Roster</Text>
                    <Table
                      dataSource={record.members}
                      pagination={false}
                      rowKey="user_id"
                      size="small"
                      showHeader={false}
                      columns={[
                        {
                          dataIndex: 'full_name',
                          key: 'full_name',
                        },
                        {
                          key: 'role',
                          render: (_, member) => {
                            if (member.user_id === record.leader_id) {
                              return <Tag color="blue" style={{ margin: 0 }}>Leader</Tag>;
                            }
                            return <Text type="secondary">Member</Text>;
                          }
                        },
                        {
                          key: 'actions',
                          align: 'right',
                          render: (_, member) => {
                            if (isEffectivelyLocked || record.status === 'CANCELLED') return null;
                            
                            const items = [];
                            if (capabilities.canTransferLeadership && member.user_id !== record.leader_id) {
                              items.push({
                                key: 'transfer',
                                label: <a onClick={() => handleTransferLeadership(record.id, member)}>Transfer Leadership</a>
                              });
                            }
                            if (capabilities.canRemoveMember) {
                              items.push({
                                key: 'remove',
                                danger: true,
                                label: <a onClick={() => handleRemoveMember(record.id, member)}>Remove Member</a>
                              });
                            }

                            if (items.length === 0) return null;

                            return (
                              <Dropdown menu={{ items }} trigger={['click']}>
                                <Button type="text" size="small" icon={<MoreOutlined />} />
                              </Dropdown>
                            );
                          }
                        }
                      ]}
                    />
                  </div>
                ),
              }}
            />
          )}
          {hasNextPage && (
            <div style={{ padding: 16, textAlign: 'center' }}>
              <Button onClick={() => fetchNextPage()} loading={isFetchingNextPage}>
                Load More
              </Button>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
