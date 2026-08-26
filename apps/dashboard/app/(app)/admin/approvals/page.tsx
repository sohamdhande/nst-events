'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCurrentUser } from '../../../../hooks/useCurrentUser';
import { useApprovals, PendingEvent } from '../../../../hooks/useApprovals';
import { Card, Button, Skeleton, Alert, Typography, Modal, Input, Space, Table } from 'antd';

const { Title, Text } = Typography;
const { TextArea } = Input;

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function ApprovalsPage() {
  const router = useRouter();
  const { data: currentUser, isLoading: isUserLoading } = useCurrentUser();
  const { data: approvalsData, isLoading: isApprovalsLoading, error: approvalsError, approveMutation, rejectMutation, refetch } = useApprovals();

  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectError, setRejectError] = useState('');

  const isAuthorized = currentUser?.global_role === 'PLATFORM_ADMIN' || 
    currentUser?.club_memberships?.some((cm) => cm.role === 'FACULTY_MENTOR');

  useEffect(() => {
    if (!isUserLoading && !isAuthorized) {
      router.replace('/dashboard');
    }
  }, [isUserLoading, isAuthorized, router]);

  if (isUserLoading || !isAuthorized) {
    return (
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <Title level={2}>Event Approvals</Title>
        <Card>
          <Skeleton active paragraph={{ rows: 4 }} />
        </Card>
      </div>
    );
  }

  const handleApprove = async (eventId: string) => {
    try {
      await approveMutation.mutateAsync(eventId);
    } catch (err) {
      console.error('Failed to approve event:', err);
    }
  };

  const handleRejectSubmit = async () => {
    if (!rejectingId) return;
    if (rejectReason.length < 10) {
      setRejectError('Reason must be at least 10 characters.');
      return;
    }
    if (rejectReason.length > 1000) {
      setRejectError('Reason must not exceed 1000 characters.');
      return;
    }
    
    setRejectError('');
    try {
      await rejectMutation.mutateAsync({ eventId: rejectingId, reason: rejectReason });
      setRejectingId(null);
      setRejectReason('');
    } catch (err) {
      setRejectError(err instanceof Error ? err.message : 'Failed to reject event.');
    }
  };

  const pendingEvents = approvalsData?.data || [];

  const handleApproveConfirm = (event: PendingEvent) => {
    Modal.confirm({
      title: 'Approve Event',
      content: (
        <Space orientation="vertical" size="small" style={{ width: '100%', marginTop: 16 }}>
          <Text strong>{event.title}</Text>
          <Text type="secondary">Club: {event.eventClubs?.[0]?.club.name || '-'}</Text>
          <Text type="secondary">Date: {formatDateTime(event.startTime)}</Text>
        </Space>
      ),
      onOk: () => handleApprove(event.id),
      okText: 'Approve',
    });
  };

  const columns = [
    {
      title: 'Event',
      dataIndex: 'title',
      key: 'title',
      render: (text: string) => (
        <Text strong style={{ color: 'var(--ant-color-primary)' }}>{text}</Text>
      )
    },
    {
      title: 'Club',
      key: 'club',
      render: (_: unknown, record: PendingEvent) => record.eventClubs?.[0]?.club.name || '-'
    },
    {
      title: 'Date',
      key: 'date',
      render: (_: unknown, record: PendingEvent) => (
        <Text>{formatDateTime(record.startTime)}</Text>
      )
    },
    {
      title: 'Submitted',
      key: 'submitted',
      render: () => <Text type="secondary">Awaiting Review</Text>
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: unknown, record: PendingEvent) => {
        const isApproving = approveMutation.isPending && approveMutation.variables === record.id;
        const isRejecting = rejectMutation.isPending && rejectMutation.variables?.eventId === record.id;
        const isActing = isApproving || isRejecting;
        return (
          <Space size="small">
            <Button size="small" href={`/events/${record.id}`}>Review</Button>
            <Button size="small" type="primary" onClick={() => handleApproveConfirm(record)} loading={isApproving} disabled={isActing}>Approve</Button>
            <Button size="small" danger onClick={() => {
              setRejectingId(record.id);
              setRejectReason('');
              setRejectError('');
            }} loading={isRejecting} disabled={isActing}>Reject</Button>
          </Space>
        );
      }
    }
  ];

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0 }}>Event Approvals</Title>
        <Text type="secondary" style={{ fontSize: 13 }}>Review and approve submitted events</Text>
      </div>

      {approvalsError ? (
        <Alert
          message="Failed to load approvals"
          description={approvalsError instanceof Error ? approvalsError.message : 'An unknown error occurred.'}
          type="error"
          showIcon
          action={
            <Button size="small" danger onClick={() => refetch()}>
              Retry
            </Button>
          }
          style={{ marginBottom: 24 }}
        />
      ) : (
        <Card size="small" variant="borderless" styles={{ body: { padding: 0 } }}>
          <Table 
            size="small"
            dataSource={pendingEvents}
            columns={columns}
            rowKey="id"
            loading={isApprovalsLoading}
            pagination={false}
            locale={{ emptyText: 'No events are awaiting approval.' }}
          />
        </Card>
      )}

      {/* Rejection Modal */}
      <Modal
        title="Reject Event"
        open={!!rejectingId}
        onOk={handleRejectSubmit}
        onCancel={() => setRejectingId(null)}
        confirmLoading={rejectMutation.isPending}
        okText="Confirm Rejection"
        okButtonProps={{ danger: true }}
      >
        <div style={{ marginBottom: 16 }}>
          <Text type="secondary">
            Please provide a reason for rejecting this event. This will be visible to the organizers.
          </Text>
        </div>
        <TextArea
          rows={4}
          placeholder="Enter rejection reason (min 10 chars)..."
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          disabled={rejectMutation.isPending}
          status={rejectError ? 'error' : ''}
        />
        {rejectError && (
          <Text type="danger" style={{ display: 'block', marginTop: 8 }}>
            {rejectError}
          </Text>
        )}
      </Modal>
    </div>
  );
}
