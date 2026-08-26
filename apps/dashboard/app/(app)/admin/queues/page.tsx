'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCurrentUser } from '../../../../hooks/useCurrentUser';
import { 
  useQueueMonitoringStats, 
  useDeadLetters, 
  useReplayDeadLetter, 
  DeadLetter 
} from '../../../../hooks/useQueueMonitoring';

import { 
  Table, 
  Tag, 
  Card, 
  Statistic, 
  Row, 
  Col, 
  Button, 
  Alert, 
  Modal, 
  Input, 
  Space, 
  Dropdown, 
  Typography 
} from 'antd';
import { 
  ReloadOutlined, 
  ExclamationCircleOutlined, 
  DownOutlined
} from '@ant-design/icons';

const { Text } = Typography;
const { confirm } = Modal;

export default function QueuesManagementPage() {
  const router = useRouter();
  const { data: currentUser, isLoading: isUserLoading } = useCurrentUser();
  
  const [filterType, setFilterType] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');

  const { 
    data: statsData, 
    isLoading: isStatsLoading,
    isError: isStatsError
  } = useQueueMonitoringStats();

  const {
    data: dlqData,
    isLoading: isDlqLoading,
    isError: isDlqError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage
  } = useDeadLetters(filterType || undefined);

  const replayMutation = useReplayDeadLetter();

  if (!isUserLoading && (!currentUser || currentUser.global_role !== 'PLATFORM_ADMIN')) {
    router.replace('/dashboard');
    return null;
  }

  const handleSearch = (value: string) => {
    setFilterType(value);
  };

  const handleReplay = (job: DeadLetter) => {
    confirm({
      title: 'Replay this dead-lettered job?',
      icon: <ExclamationCircleOutlined />,
      content: 'The job will be placed back into the processing queue.',
      okText: 'Replay',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: () => {
        return replayMutation.mutateAsync(job.id);
      },
    });
  };

  const dlqJobs = dlqData?.pages.flatMap(page => page.data) || [];

  const columns = [
    {
      title: 'Job Type',
      dataIndex: 'payload',
      key: 'type',
      render: (payload: unknown) => {
        const type = (payload as { job_type?: string })?.job_type || 'UNKNOWN';
        return <Tag color="geekblue">{type}</Tag>;
      },
    },
    {
      title: 'Created At',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (text: string) => <Text className="text-xs">{new Date(text).toLocaleString()}</Text>,
    },
    {
      title: 'Last Attempt',
      dataIndex: 'updated_at',
      key: 'updated_at',
      render: (text: string) => <Text className="text-xs">{new Date(text).toLocaleString()}</Text>,
    },
    {
      title: 'Attempts',
      dataIndex: 'attempt_count',
      key: 'attempt_count',
      width: 100,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => <Tag color="red">{status}</Tag>,
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_text: unknown, record: DeadLetter) => {
        const items = [
          {
            key: 'replay',
            label: 'Replay',
            icon: <ReloadOutlined />,
            onClick: () => handleReplay(record),
          }
        ];
        return (
          <Dropdown menu={{ items }} trigger={['click']}>
            <Button size="small">
              Actions <DownOutlined />
            </Button>
          </Dropdown>
        );
      },
      width: 120,
    },
  ];

  const expandedRowRender = (record: DeadLetter) => {
    return (
      <div className="bg-gray-50 p-4 border border-gray-200 rounded text-xs space-y-4">
        <div>
          <strong className="block text-gray-700 mb-1">Last Error:</strong>
          <pre className="bg-white p-2 rounded border border-gray-200 overflow-auto max-h-40 whitespace-pre-wrap text-red-600">
            {record.last_error || 'No error details recorded.'}
          </pre>
        </div>
        <div>
          <strong className="block text-gray-700 mb-1">Payload:</strong>
          <pre className="bg-white p-2 rounded border border-gray-200 overflow-auto max-h-40">
            {record.payload ? JSON.stringify(record.payload, null, 2) : 'No payload'}
          </pre>
        </div>
      </div>
    );
  };

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>Queues & Dead Letters</Typography.Title>
        <Typography.Text type="secondary" style={{ fontSize: 13 }}>
          Monitor asynchronous jobs, failures, and dead-lettered operations.
        </Typography.Text>
      </div>

      {isStatsError && (
        <Alert
          message="Failed to load queue summary."
          type="error"
          showIcon
          style={{ marginBottom: 24 }}
        />
      )}

      {/* Queue Summary */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={6}>
          <Card size="small" styles={{ body: { background: 'var(--ant-color-bg-layout)' } }}>
            <Statistic 
              title="Pending" 
              value={statsData?.pending_count ?? '-'} 
              loading={isStatsLoading} 
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" styles={{ body: { background: 'var(--ant-color-info-bg)' } }}>
            <Statistic 
              title="Processing" 
              value={statsData?.processing_count ?? '-'} 
              loading={isStatsLoading} 
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" styles={{ body: { background: 'var(--ant-color-warning-bg)' } }}>
            <Statistic 
              title="Failed" 
              value={statsData?.failed_count ?? '-'} 
              loading={isStatsLoading} 
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" styles={{ body: { background: 'var(--ant-color-error-bg)' } }}>
            <Statistic 
              title="Dead Lettered" 
              value={statsData?.dead_letter_count ?? '-'} 
              loading={isStatsLoading} 
              styles={{ content: { color: 'var(--ant-color-error)' } }}
            />
          </Card>
        </Col>
      </Row>

      {isDlqError && (
        <Alert
          message="Failed to load dead-lettered jobs."
          type="error"
          showIcon
          style={{ marginBottom: 24 }}
        />
      )}

      {/* Dead Letters Table */}
      <Card size="small" variant="borderless" styles={{ body: { padding: 0 } }}>
        <div style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--ant-color-border-secondary)' }}>
          <Text strong>Dead-Lettered Jobs</Text>
          <Space>
            {filterType && (
              <Button type="link" size="small" onClick={() => { setSearchQuery(''); setFilterType(''); }}>
                Clear Filters
              </Button>
            )}
            <Input.Search
              placeholder="Filter by Job Type"
              allowClear
              onSearch={handleSearch}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: 250 }}
            />
          </Space>
        </div>
        <Table
          dataSource={dlqJobs}
          columns={columns}
          rowKey="id"
          loading={isDlqLoading}
          pagination={false}
          size="small"
          expandable={{
            expandedRowRender,
            expandRowByClick: true,
          }}
          locale={{
            emptyText: filterType ? 'No dead-lettered jobs match your filters.' : 'No dead-lettered jobs.',
          }}
        />
        {hasNextPage && (
          <div style={{ padding: 16, textAlign: 'center', borderTop: '1px solid var(--ant-color-border-secondary)' }}>
            <Button 
              onClick={() => fetchNextPage()} 
              loading={isFetchingNextPage}
            >
              Load More
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
