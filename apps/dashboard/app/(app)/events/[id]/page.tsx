'use client';

import { use, useMemo, useState } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Card, Skeleton, Alert, Typography, Row, Col, Tag, Space, Button, Breadcrumb, theme, Popconfirm, Modal, Input, App } from 'antd';
import { LockOutlined, UnlockOutlined, CheckCircleOutlined, CloseCircleOutlined, SendOutlined, EditOutlined, IdcardOutlined, QrcodeOutlined, RightOutlined, TeamOutlined } from '@ant-design/icons';
import { useEventDetail, EventDetail } from '../../../../hooks/useEventDetail';
import { useEventLiveUpdates } from '../../../../hooks/useEventLiveUpdates';
import { useCurrentUser } from '../../../../hooks/useCurrentUser';
import { useEventLifecycle } from '../../../../hooks/useEventLifecycle';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

function getEventStatus(event: EventDetail): 'OPEN' | 'CLOSED' {
  if (
    event.state === 'PUBLISHED' &&
    !event.isLocked &&
    (event.maxCapacity === null || event.registrationCount < event.maxCapacity)
  ) {
    return 'OPEN';
  }
  return 'CLOSED';
}

export default function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const unwrappedParams = use(params);
  const eventId = unwrappedParams.id;
  const { token } = theme.useToken();
  const { message } = App.useApp();

  const { data: event, isLoading: isLoadingEvent, isError: isErrorEvent, error: errorEvent, refetch: refetchEvent } = useEventDetail(eventId);
  const { data: currentUser } = useCurrentUser();

  const { submitMutation, approveMutation, rejectMutation, lockMutation, unlockMutation } = useEventLifecycle();

  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const [publishModalOpen, setPublishModalOpen] = useState(false);
  const [publishLoading, setPublishLoading] = useState(false);
  const [publishPartialFailure, setPublishPartialFailure] = useState(false);

  useEventLiveUpdates(eventId);

  const auth = useMemo(() => {
    let isGlobalAdmin = false;
    let isClubAdmin = false;
    let isEventEditor = false;
    let isMentor = false;
    let isCoreMember = false;

    if (currentUser && event) {
      if (currentUser.global_role === 'PLATFORM_ADMIN' || currentUser.global_role === 'FACULTY_ADMIN') {
        isGlobalAdmin = true;
      }
      
      const userAdminClubs = currentUser.club_memberships
        .filter(m => m.role === 'CLUB_ADMIN') 
        .map(m => m.club_id);

      const userCoreClubs = currentUser.club_memberships
        .filter(m => m.role === 'CORE_MEMBER') 
        .map(m => m.club_id);
      
      const userMentorClubs = currentUser.club_memberships
        .filter(m => m.role === 'FACULTY_MENTOR') 
        .map(m => m.club_id);

      isClubAdmin = event.eventClubs?.some(ec => userAdminClubs.includes(ec.clubId)) ?? false;
      isCoreMember = event.eventClubs?.some(ec => userCoreClubs.includes(ec.clubId)) ?? false;
      isEventEditor = isGlobalAdmin || isClubAdmin;
      isMentor = event.eventClubs?.some(ec => userMentorClubs.includes(ec.clubId)) ?? false;
    }

    const canManageRegistrations = isGlobalAdmin || isClubAdmin || isCoreMember || isMentor;
    const canManageTeams = canManageRegistrations && event?.registrationType === 'TEAM';
    const canManageAttendance = isGlobalAdmin || isClubAdmin || isCoreMember || isMentor;
    const canEdit = isEventEditor && event?.state === 'DRAFT';
    const canSubmit = isClubAdmin && event?.state === 'DRAFT';
    const canApprove = (isGlobalAdmin || isMentor) && event?.state === 'PENDING_APPROVAL';
    const canReject = (isGlobalAdmin || isMentor) && event?.state === 'PENDING_APPROVAL';
    const canLock = (isGlobalAdmin || isClubAdmin || isMentor) && event?.state === 'PUBLISHED';
    const canUnlock = (isGlobalAdmin || isClubAdmin || isMentor) && event?.state === 'PUBLISHED';

    return {
      isGlobalAdmin,
      isClubAdmin,
      isEventEditor,
      isMentor,
      isCoreMember,
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
  }, [currentUser, event]);

  if (isLoadingEvent) {
    return (
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <Row gutter={[24, 24]}>
          <Col xs={24} lg={16}>
            <Skeleton active paragraph={{ rows: 6 }} />
          </Col>
          <Col xs={24} lg={8}>
            <Card>
              <Skeleton active paragraph={{ rows: 4 }} />
            </Card>
          </Col>
        </Row>
      </div>
    );
  }

  if (isErrorEvent) {
    if ((errorEvent as Error)?.message?.includes('404')) {
      notFound();
    }
    return (
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <Alert
          title="Failed to load event"
          description="We couldn't retrieve the event details at this time."
          type="error"
          showIcon
          action={<Button size="small" danger onClick={() => refetchEvent()}>Retry</Button>}
        />
      </div>
    );
  }

  if (!event) return null;

  const status = getEventStatus(event);
  const spotsLeft = event.maxCapacity === null 
    ? 'Unlimited spots' 
    : `${Math.max(0, event.maxCapacity - event.registrationCount)} spots left`;

  const isEffectivelyLocked = event.isLocked;
  const anyMutationPending = submitMutation.isPending || approveMutation.isPending || rejectMutation.isPending || lockMutation.isPending || unlockMutation.isPending;

  const handleReject = () => {
    if (!rejectReason.trim()) {
      message.error('Please provide a rejection reason.');
      return;
    }
    rejectMutation.mutate({ eventId, reason: rejectReason.trim() }, {
      onSuccess: () => {
        message.success('Event returned to Draft.');
        setRejectModalOpen(false);
        setRejectReason('');
      },
      onError: (err) => message.error(err.message || 'Failed to reject event')
    });
  };

  const handlePublish = () => {
    setPublishLoading(true);
    setPublishPartialFailure(false);
    
    submitMutation.mutate(eventId, {
      onSuccess: () => {
        approveMutation.mutate(eventId, {
          onSuccess: () => {
            message.success('Event published!');
            setPublishModalOpen(false);
            setPublishLoading(false);
          },
          onError: (err) => {
            message.error(err.message || 'Failed to approve event. Event is now pending approval.');
            setPublishPartialFailure(true);
            setPublishModalOpen(false);
            setPublishLoading(false);
          }
        });
      },
      onError: (err) => {
        message.error(err.message || 'Failed to submit event for approval');
        setPublishLoading(false);
      }
    });
  };

  const handleRetryPublish = () => {
    setPublishLoading(true);
    approveMutation.mutate(eventId, {
      onSuccess: () => {
        message.success('Event published!');
        setPublishPartialFailure(false);
        setPublishLoading(false);
      },
      onError: (err) => {
        message.error(err.message || 'Failed to approve event');
        setPublishLoading(false);
      }
    });
  };

  const renderLifecyclePanel = () => {
    if (event.state === 'DRAFT') {
      if (auth.canSubmit || auth.canEdit || auth.isGlobalAdmin) {
        return (
          <Card style={{ marginBottom: 24, border: `1px solid ${token.colorPrimary}` }}>
            <Space orientation="vertical" style={{ width: '100%' }}>
              <Text strong>Event Lifecycle: Draft</Text>
              <Text type="secondary">This event is not visible to students until it is published.</Text>
              <Space wrap style={{ marginTop: 8 }}>
                {auth.canEdit && (
                  <Link href={`/events/${eventId}/edit`}>
                    <Button icon={<EditOutlined />}>Edit Event</Button>
                  </Link>
                )}
                {auth.isGlobalAdmin && (
                  <Button 
                    type="primary" 
                    icon={<SendOutlined />} 
                    onClick={() => setPublishModalOpen(true)}
                    loading={publishLoading} 
                    disabled={anyMutationPending || publishLoading}
                  >
                    Publish Event
                  </Button>
                )}
                {auth.canSubmit && !auth.isGlobalAdmin && (
                  <Popconfirm
                    title="Submit this event for faculty approval?"
                    onConfirm={() => submitMutation.mutate(eventId, {
                      onSuccess: () => message.success('Event submitted for approval'),
                      onError: (err) => message.error(err.message || 'Failed to submit')
                    })}
                  >
                    <Button type="primary" icon={<SendOutlined />} loading={submitMutation.isPending} disabled={anyMutationPending}>
                      Submit for Approval
                    </Button>
                  </Popconfirm>
                )}
              </Space>
            </Space>
          </Card>
        );
      }
    }

    if (event.state === 'PENDING_APPROVAL') {
      if (publishPartialFailure) {
        return (
          <Card style={{ marginBottom: 24, border: `1px solid ${token.colorError}` }}>
            <Space orientation="vertical" style={{ width: '100%' }}>
              <Text strong>Publish Incomplete</Text>
              <Text type="danger">Event submitted for approval, but could not be published.</Text>
              <Space wrap style={{ marginTop: 8 }}>
                <Button 
                  type="primary" 
                  danger
                  onClick={handleRetryPublish} 
                  loading={publishLoading} 
                  disabled={anyMutationPending || publishLoading}
                >
                  Retry Publish
                </Button>
              </Space>
            </Space>
          </Card>
        );
      }

      if (auth.canApprove || auth.canReject) {
        return (
          <Card style={{ marginBottom: 24, border: `1px solid ${token.colorWarning}` }}>
            <Space orientation="vertical" style={{ width: '100%' }}>
              <Text strong>Action Required: Pending Approval</Text>
              <Text type="secondary">Please review the event details before approving or rejecting.</Text>
              <Space wrap style={{ marginTop: 8 }}>
                {auth.canReject && (
                  <Button danger icon={<CloseCircleOutlined />} onClick={() => setRejectModalOpen(true)} disabled={anyMutationPending || publishLoading}>
                    Reject Event
                  </Button>
                )}
                {auth.canApprove && (
                  <Popconfirm
                    title="Approve this event? It will become published and visible according to its visibility settings."
                    onConfirm={() => approveMutation.mutate(eventId, {
                      onSuccess: () => message.success('Event approved and published!'),
                      onError: (err) => message.error(err.message || 'Failed to approve')
                    })}
                  >
                    <Button type="primary" icon={<CheckCircleOutlined />} loading={approveMutation.isPending} disabled={anyMutationPending || publishLoading}>
                      Approve Event
                    </Button>
                  </Popconfirm>
                )}
              </Space>
            </Space>
          </Card>
        );
      }
    }

    if (event.state === 'PUBLISHED') {
      if (auth.canLock || auth.canUnlock) {
        return (
          <Card style={{ marginBottom: 24 }}>
            <Space align="center" style={{ width: '100%', justifyContent: 'space-between' }}>
              <Space orientation="vertical" size={0}>
                <Text strong>Event Lifecycle</Text>
                <Text type="secondary">This event is live.</Text>
              </Space>
              {event.isLocked ? (
                <Button 
                  icon={<UnlockOutlined />} 
                  loading={unlockMutation.isPending} 
                  disabled={anyMutationPending || isEffectivelyLocked}
                  onClick={() => unlockMutation.mutate(eventId, {
                    onSuccess: () => message.success('Event unlocked'),
                    onError: (err) => message.error(err.message || 'Failed to unlock')
                  })}
                >
                  Unlock Event
                </Button>
              ) : (
                <Button 
                  danger 
                  icon={<LockOutlined />} 
                  loading={lockMutation.isPending} 
                  disabled={anyMutationPending || isEffectivelyLocked}
                  onClick={() => lockMutation.mutate(eventId, {
                    onSuccess: () => message.success('Event locked'),
                    onError: (err) => message.error(err.message || 'Failed to lock')
                  })}
                >
                  Lock Event
                </Button>
              )}
            </Space>
          </Card>
        );
      }
    }

    if (event.state === 'ARCHIVED') {
      return (
        <Alert
          title="ARCHIVED — Read-only event"
          description="This event has been archived and can no longer be modified."
          type="info"
          showIcon
          style={{ marginBottom: 24 }}
        />
      );
    }

    return null;
  };

  const renderOperationsNav = () => {
    if (event.state !== 'PUBLISHED' && event.state !== 'ARCHIVED') return null;

    const data = [];
    if (auth.canManageRegistrations) {
      data.push({
        title: 'Registrations',
        description: 'Manage participants and registration status',
        icon: <IdcardOutlined style={{ fontSize: 24, color: token.colorPrimary }} />,
        link: `/events/${eventId}/registrations`
      });
    }
    if (auth.canManageTeams) {
      data.push({
        title: 'Teams',
        description: 'Review team composition and members',
        icon: <TeamOutlined style={{ fontSize: 24, color: token.colorPrimary }} />,
        link: `/events/${eventId}/teams`
      });
    }
    if (auth.canManageAttendance) {
      data.push({
        title: 'Attendance',
        description: 'Manage sessions and attendance records',
        icon: <QrcodeOutlined style={{ fontSize: 24, color: token.colorPrimary }} />,
        link: `/events/${eventId}/attendance`
      });
    }

    if (data.length === 0) return null;

    return (
      <Card title="EVENT OPERATIONS" style={{ marginBottom: 24 }} styles={{ body: { padding: 0 } }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {data.map((item, index) => (
              <Link 
                key={item.title} 
                href={item.link} 
                style={{ display: 'block', borderTop: index > 0 ? `1px solid ${token.colorBorderSecondary}` : 'none' }}
              >
                <div 
                  style={{ padding: '16px 24px', display: 'flex', alignItems: 'center', transition: 'background-color 0.2s', cursor: 'pointer' }}
                  className="hover-bg-layout"
                >
                  <div style={{ marginRight: 16 }}>{item.icon}</div>
                  <div style={{ flex: 1 }}>
                    <Text strong style={{ display: 'block', marginBottom: 4 }}>{item.title}</Text>
                    <Text type="secondary">{item.description}</Text>
                  </div>
                  <div>
                    <RightOutlined style={{ color: token.colorTextSecondary }} />
                  </div>
                </div>
              </Link>
          ))}
        </div>
        <style dangerouslySetInnerHTML={{__html: `
          .hover-bg-layout:hover {
            background-color: ${token.colorBgLayout};
          }
        `}} />
      </Card>
    );
  };

  const renderEventSummary = () => (
    <Card style={{ marginBottom: 24 }} size="small">
      <Row gutter={[16, 16]}>
        <Col xs={12} md={6} lg={4}>
          <Text type="secondary" style={{ fontSize: 12 }}>DATE / TIME</Text>
          <div style={{ marginTop: 4 }}>
            <Text strong style={{ display: 'block' }}>{new Date(event.startTime).toLocaleDateString()}</Text>
            <Text type="secondary">{new Date(event.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
          </div>
        </Col>
        <Col xs={12} md={6} lg={4}>
          <Text type="secondary" style={{ fontSize: 12 }}>LOCATION</Text>
          <div style={{ marginTop: 4 }}>
            <Text strong>{event.locationName || 'TBA'}</Text>
          </div>
        </Col>
        <Col xs={12} md={6} lg={4}>
          <Text type="secondary" style={{ fontSize: 12 }}>REGISTRATIONS</Text>
          <div style={{ marginTop: 4 }}>
            <Text strong>{event.registrationCount}</Text>
            <Text type="secondary"> / {event.maxCapacity ?? '∞'}</Text>
          </div>
        </Col>
        <Col xs={12} md={6} lg={4}>
          <Text type="secondary" style={{ fontSize: 12 }}>STATUS</Text>
          <div style={{ marginTop: 4 }}>
            <Text strong>{status}</Text>
          </div>
        </Col>
        <Col xs={12} md={6} lg={4}>
          <Text type="secondary" style={{ fontSize: 12 }}>AUDIENCE</Text>
          <div style={{ marginTop: 4 }}>
            {event.audience === 'ALL_STUDENTS' ? (
              <Text strong>All Students</Text>
            ) : (
              <Text strong>{event.audienceBatchIds?.length || 0} batches</Text>
            )}
          </div>
        </Col>
        <Col xs={12} md={6} lg={4}>
          <Text type="secondary" style={{ fontSize: 12 }}>TEAM RULES</Text>
          <div style={{ marginTop: 4 }}>
            {event.registrationType === 'TEAM' ? (
              <Text strong>{String(event.metadata?.minimum_team_size || 1)} - {String(event.metadata?.maximum_team_size || '∞')} members</Text>
            ) : (
              <Text strong>Individual</Text>
            )}
          </div>
        </Col>
      </Row>
      <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${token.colorBorderSecondary}` }}>
        <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>LOCK STATUS</Text>
        {isEffectivelyLocked ? (
          <Text type="warning" strong><LockOutlined /> LOCKED — READ-ONLY. Registration and team operations are frozen.</Text>
        ) : (
          <Text type="success" strong><UnlockOutlined /> UNLOCKED — Active mutations allowed.</Text>
        )}
      </div>
      {event.registrationType === 'TEAM' && (
        <div style={{ marginTop: 8 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>Teams register as groups; capacity counts individual members.</Text>
        </div>
      )}
    </Card>
  );

  return (
    <article style={{ maxWidth: 1200, margin: '0 auto' }}>
      <Breadcrumb
        style={{ marginBottom: 24 }}
        items={[
          { title: <Link href="/events">Events</Link> },
          { title: event.title },
        ]}
      />

      <Row gutter={[32, 32]}>
        {/* Main Column */}
        <Col xs={24} lg={16}>
          <div style={{ marginBottom: 24 }}>
            <Space align="center" style={{ marginBottom: 8, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <Title level={1} style={{ margin: 0 }}>{event.title}</Title>
              <Text strong style={{ color: token.colorPrimary, border: `1px solid ${token.colorPrimary}`, padding: '2px 8px', borderRadius: 4, fontSize: 12 }}>
                {event.state.replace('_', ' ')}
              </Text>
            </Space>
            
            <Space separator={<Text type="secondary">•</Text>} wrap style={{ fontSize: 14 }}>
              {event.eventClubs && event.eventClubs.length > 0 && (
                <Text strong>{event.eventClubs[0].club.name}</Text>
              )}
              <Text type="secondary">{event.eventType?.replace('_', ' ')}</Text>
              <Text type="secondary">{event.visibility}</Text>
              {event.audience === 'ALL_STUDENTS' ? (
                <Text type="secondary">All Students</Text>
              ) : (
                <Text type="secondary">{event.audienceBatchIds?.length || 0} specific batches</Text>
              )}
            </Space>
          </div>
          
          {event.below_minimum_team_count && event.below_minimum_team_count > 0 ? (
            <Alert
              message={`${event.below_minimum_team_count} team${event.below_minimum_team_count === 1 ? ' is' : 's are'} below the minimum team size.`}
              type="warning"
              showIcon
              action={
                !isEffectivelyLocked && (
                  <Link href={`/events/${event.id}/teams`}>
                    <Button size="small" type="default">Manage Teams</Button>
                  </Link>
                )
              }
              style={{ marginBottom: 24 }}
            />
          ) : null}

          {/* Event Review Summary for Approvers */}
          {event.state === 'PENDING_APPROVAL' && (
            <Card style={{ marginBottom: 24, border: `1px solid ${token.colorWarning}` }} title="REVIEW SUMMARY" size="small">
              <Row gutter={[16, 16]}>
                <Col span={24}>
                  <Text type="secondary" style={{ fontSize: 12 }}>BASIC INFORMATION</Text>
                  <div style={{ marginTop: 4 }}>
                    <Text strong>{event.title}</Text>
                    <div><Text type="secondary">{event.eventType?.replace('_', ' ')} • {event.visibility}</Text></div>
                  </div>
                </Col>
                <Col span={24}>
                  <Text type="secondary" style={{ fontSize: 12 }}>SCHEDULE & LOCATION</Text>
                  <div style={{ marginTop: 4 }}>
                    <Text strong>{new Date(event.startTime).toLocaleString()} - {new Date(event.endTime).toLocaleString()}</Text>
                    <div><Text type="secondary">{event.locationName || 'TBA'}</Text></div>
                  </div>
                </Col>
                <Col span={12}>
                  <Text type="secondary" style={{ fontSize: 12 }}>PRIMARY CLUB</Text>
                  <div style={{ marginTop: 4 }}>
                    <Text strong>{event.eventClubs?.[0]?.club.name || '-'}</Text>
                  </div>
                </Col>
                <Col span={12}>
                  <Text type="secondary" style={{ fontSize: 12 }}>AUDIENCE</Text>
                  <div style={{ marginTop: 4 }}>
                    <Text strong>{event.audience === 'ALL_STUDENTS' ? 'All Students' : `${event.audienceBatchIds?.length || 0} Batches`}</Text>
                  </div>
                </Col>
                <Col span={12}>
                  <Text type="secondary" style={{ fontSize: 12 }}>REGISTRATION TYPE</Text>
                  <div style={{ marginTop: 4 }}>
                    <Text strong>{event.registrationType === 'TEAM' ? 'Team Registration' : 'Individual'}</Text>
                    {event.registrationType === 'TEAM' && (
                      <div><Text type="secondary">Min {String(event.metadata?.minimum_team_size || 1)} — Max {String(event.metadata?.maximum_team_size || '∞')}</Text></div>
                    )}
                  </div>
                </Col>
                <Col span={12}>
                  <Text type="secondary" style={{ fontSize: 12 }}>CAPACITY</Text>
                  <div style={{ marginTop: 4 }}>
                    <Text strong>{event.maxCapacity ?? 'Unlimited'}</Text>
                  </div>
                </Col>
              </Row>
            </Card>
          )}

          {renderEventSummary()}
          {!isEffectivelyLocked && renderLifecyclePanel()}
          {renderOperationsNav()}

          <Card title="Event Description" style={{ marginBottom: 24 }}>
            <Paragraph style={{ whiteSpace: 'pre-wrap', fontSize: 16, margin: 0 }}>
              {event.description}
            </Paragraph>
          </Card>
        </Col>

        {/* Sidebar Column */}
        <Col xs={24} lg={8}>
          <Space direction="vertical" size="large" style={{ width: '100%', position: 'sticky', top: 24 }}>
            {/* Operational Status Card */}
            <Card title="OPERATIONAL STATUS" size="small">
              <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                {isEffectivelyLocked && (
                  <Tag color="error" style={{ width: '100%', margin: 0, padding: 8, fontSize: 13, textAlign: 'center' }}>
                    <LockOutlined /> LOCKED
                  </Tag>
                )}
                
                {event.state === 'PENDING_APPROVAL' && (
                  <Tag color="warning" style={{ width: '100%', margin: 0, padding: 8, fontSize: 13, textAlign: 'center' }}>
                    PENDING APPROVAL
                  </Tag>
                )}

                {!isEffectivelyLocked && event.below_minimum_team_count && event.below_minimum_team_count > 0 ? (
                  <Tag color="warning" style={{ width: '100%', margin: 0, padding: 8, fontSize: 13, textAlign: 'center' }}>
                    NEEDS ATTENTION
                  </Tag>
                ) : null}

                {event.maxCapacity !== null && (event.registrationCount / event.maxCapacity >= 0.9) && (
                  <Tag color="warning" style={{ width: '100%', margin: 0, padding: 8, fontSize: 13, textAlign: 'center' }}>
                    NEAR CAPACITY
                  </Tag>
                )}

                {/* Healthy fallback */}
                {(!isEffectivelyLocked && event.state === 'PUBLISHED' && (!event.below_minimum_team_count || event.below_minimum_team_count === 0) && (event.maxCapacity === null || event.registrationCount / event.maxCapacity < 0.9)) && (
                  <Tag color="success" style={{ width: '100%', margin: 0, padding: 8, fontSize: 13, textAlign: 'center' }}>
                    <CheckCircleOutlined /> HEALTHY
                  </Tag>
                )}
              </Space>
            </Card>

            <Card title="Registration">
              <div style={{ textAlign: 'center', marginBottom: 24 }}>
                <Space align="baseline">
                  <Text style={{ fontSize: 36, fontWeight: 'bold' }}>{event.registrationCount}</Text>
                  <Text type="secondary">/ {event.maxCapacity ?? '∞'} registered</Text>
                </Space>
                <Text type="secondary" style={{ display: 'block' }}>{spotsLeft}</Text>
                {event.state === 'PUBLISHED' && (
                  <Tag color={status === 'OPEN' ? 'success' : 'default'} style={{ marginTop: 16, fontSize: 14, padding: '4px 12px' }}>
                    {status}
                  </Tag>
                )}
              </div>
            </Card>
          </Space>
        </Col>
      </Row>

      <Modal
        title="Reject Event"
        open={rejectModalOpen}
        onOk={handleReject}
        confirmLoading={rejectMutation.isPending}
        onCancel={() => {
          if (!rejectMutation.isPending) {
            setRejectModalOpen(false);
            setRejectReason('');
          }
        }}
        okText="Reject Event"
        okButtonProps={{ danger: true }}
      >
        <Space orientation="vertical" style={{ width: '100%' }}>
          <Text>Please provide a reason for rejecting this event.</Text>
          <TextArea
            rows={4}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Rejection reason..."
            disabled={rejectMutation.isPending}
          />
        </Space>
      </Modal>

      <Modal
        title="Publish this event?"
        open={publishModalOpen}
        onOk={handlePublish}
        confirmLoading={publishLoading}
        onCancel={() => {
          if (!publishLoading) {
            setPublishModalOpen(false);
          }
        }}
        okText="Publish Event"
      >
        <Text>Publishing will approve the event and make it live according to its visibility settings.</Text>
      </Modal>
    </article>
  );
}
