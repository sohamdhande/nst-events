'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCurrentUser } from '../../../hooks/useCurrentUser';
import { useAuditLogs } from '../../../hooks/useAuditLogs';
import { useRecalculateLeaderboard } from '../../../hooks/useLeaderboard';
import { canRecalculateLeaderboard } from '../../../lib/auth-helpers';
import { Card, Button, Skeleton, Alert, Typography, Row, Col, Table, theme, Modal, message } from 'antd';

const { Title, Text } = Typography;

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

export default function AdminHubPage() {
  const router = useRouter();
  const { token } = theme.useToken();
  const { data: currentUser, isLoading: isUserLoading } = useCurrentUser();
  const isPlatformAdmin = currentUser?.global_role === 'PLATFORM_ADMIN';
  const isFacultyAdmin = currentUser?.global_role === 'FACULTY_ADMIN';
  const isAdmin = isPlatformAdmin || isFacultyAdmin;

  const { data: auditLogs, isLoading: isLogsLoading, error: logsError, refetch } = useAuditLogs({ enabled: isPlatformAdmin });

  const canRecalculate = canRecalculateLeaderboard(currentUser);
  
  const recalculateLeaderboard = useRecalculateLeaderboard();

  const handleRecalculateLeaderboard = () => {
    Modal.confirm({
      title: 'Recalculate Leaderboard?',
      content: 'Are you sure you want to trigger a full leaderboard recalculation? This may take some time depending on the amount of data.',
      okText: 'Recalculate Now',
      okType: 'primary',
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          await recalculateLeaderboard.mutateAsync();
          message.success('Leaderboard recalculation triggered successfully');
        } catch (err: unknown) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          message.error((err as any).response?.data?.error || 'Failed to trigger recalculation');
        }
      }
    });
  };

  useEffect(() => {
    if (!isUserLoading && !isAdmin) {
      router.replace('/dashboard');
    }
  }, [isUserLoading, isAdmin, router]);

  if (isUserLoading || !isAdmin) {
    return (
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <Title level={2}>Platform Administration</Title>
        <Row gutter={[24, 24]}>
          <Col xs={24} lg={12}>
            <Card>
              <Skeleton active paragraph={{ rows: 4 }} />
            </Card>
          </Col>
          <Col xs={24} lg={12}>
            <Card>
              <Skeleton active paragraph={{ rows: 8 }} />
            </Card>
          </Col>
        </Row>
      </div>
    );
  }

  const columns = [
    {
      title: 'Action',
      dataIndex: 'action',
      key: 'action',
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: 'Actor ID',
      dataIndex: 'actorId',
      key: 'actorId',
      render: (text: string) => text || '-',
    },
    {
      title: 'Target',
      key: 'target',
      render: (_: unknown, record: { entityType: string; entityId: string | null }) => `${record.entityType} - ${record.entityId || '-'}`,
    },
    {
      title: 'Time',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (text: string) => formatRelativeTime(text),
      align: 'right' as const,
    },
  ];

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <Title level={2} style={{ margin: 0 }}>Platform Administration</Title>
      </div>
      
      <Row gutter={[24, 24]}>
        {/* Quick Actions */}
        {isPlatformAdmin && (
          <Col xs={24} lg={12}>
            <Card title="Quick Actions" style={{ height: '100%' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: token.colorBgLayout, borderRadius: 8 }}>
                  <div>
                    <Text strong style={{ display: 'block' }}>Point Adjustments</Text>
                    <Text type="secondary">Manually adjust student or club points.</Text>
                  </div>
                  <Button disabled>DEFERRED TO V2</Button>
                </div>
                
                {canRecalculate && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: token.colorBgLayout, borderRadius: 8 }}>
                    <div>
                      <Text strong style={{ display: 'block' }}>Leaderboard Recalculation</Text>
                      <Text type="secondary">Force a manual update of the global leaderboard materialized views.</Text>
                    </div>
                    <Button type="primary" onClick={handleRecalculateLeaderboard}>Recalculate Now</Button>
                  </div>
                )}
              </div>
            </Card>
          </Col>
        )}

        {/* Audit Logs */}
        {isPlatformAdmin && (
          <Col xs={24} lg={12}>
          <Card title="Recent Audit Logs" style={{ height: '100%' }} styles={{ body: { padding: 0 } }}>
            {logsError ? (
              <div style={{ padding: 24 }}>
                <Alert
                  title="Failed to load audit logs"
                  description={logsError instanceof Error ? logsError.message : 'An unknown error occurred.'}
                  type="error"
                  showIcon
                  action={
                    <Button size="small" danger onClick={() => refetch()}>
                      Retry
                    </Button>
                  }
                />
              </div>
            ) : (
              <Table
                dataSource={auditLogs?.data || []}
                columns={columns}
                rowKey="id"
                pagination={false}
                loading={isLogsLoading}
                scroll={{ x: true }}
                size="middle"
              />
            )}
          </Card>
        </Col>
        )}
      </Row>
    </div>
  );
}
