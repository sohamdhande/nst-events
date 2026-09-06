import React, { useState } from 'react';
import { Table, Button, Badge, Space, Modal, Form, Input, Typography, Select, App } from 'antd';
import { useAttendanceDisputes, useResolveAttendanceDispute, AttendanceDispute } from '../../../../../hooks/useAttendance';
import { ApiError } from '../../../../../lib/api';

const { Text } = Typography;

export function AttendanceDisputes({ eventId, clubId, canManageAttendance }: { eventId?: string; clubId?: string; canManageAttendance: boolean }) {
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useAttendanceDisputes(eventId, clubId);
  const resolveMutation = useResolveAttendanceDispute(eventId, clubId);
  const { message, modal } = App.useApp();

  const [resolveModalOpen, setResolveModalOpen] = useState(false);
  const [selectedDispute, setSelectedDispute] = useState<AttendanceDispute | null>(null);
  const [form] = Form.useForm();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleResolve = async (values: any) => {
    if (!selectedDispute) return;
    try {
      await resolveMutation.mutateAsync({
        id: selectedDispute.id,
        resolution: values.resolution,
        review_notes: values.review_notes,
      });
      message.success('Dispute resolved successfully');
      setResolveModalOpen(false);
      form.resetFields();
    } catch (err: unknown) {
      const error = err as ApiError;
      message.error(error.data?.detail || error.message || 'Failed to resolve dispute');
    }
  };

  const columns = [
    {
      title: 'Event',
      key: 'event',
      render: (_: unknown, record: any) => record.event?.title || 'Unknown Event'
    },
    {
      title: 'Student',
      key: 'student',
      render: (_: unknown, record: AttendanceDispute) => <Text strong>{record.user?.fullName || record.userId}</Text>
    },
    {
      title: 'Status',
      key: 'status',
      render: (_: unknown, record: AttendanceDispute) => {
        const color = record.status === 'PENDING' ? 'processing' : record.status === 'APPROVED' ? 'success' : 'error';
        return <Badge status={color} text={record.status} />;
      }
    },
    {
      title: 'Reason',
      dataIndex: 'reason',
      key: 'reason',
      render: (text: string) => <Text ellipsis style={{ maxWidth: 300 }} title={text}>{text}</Text>
    },
    {
      title: 'Submitted',
      key: 'submittedAt',
      render: (_: unknown, record: AttendanceDispute) => new Date(record.submittedAt).toLocaleDateString()
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: unknown, record: AttendanceDispute) => (
        <Space>
          {record.status === 'PENDING' && canManageAttendance ? (
            <Button size="small" type="primary" onClick={() => {
              setSelectedDispute(record);
              setResolveModalOpen(true);
            }}>Review</Button>
          ) : (
            <Button size="small" onClick={() => {
              modal.info({
                title: 'Dispute Details',
                content: (
                  <div style={{ marginTop: 16 }}>
                    <p><strong>Reason:</strong> {record.reason}</p>
                    <p><strong>Resolution:</strong> {record.status}</p>
                    {record.reviewNotes && <p><strong>Notes:</strong> {record.reviewNotes}</p>}
                  </div>
                ),
                mask: { closable: true }
              });
            }}>View Details</Button>
          )}
        </Space>
      )
    }
  ];

  const disputes = data?.pages.flatMap(p => p.data) || [];

  return (
    <div>
      <Table 
        dataSource={disputes}
        columns={columns}
        rowKey="id"
        loading={isLoading}
        pagination={false}
      />
      {hasNextPage && (
        <Button onClick={() => fetchNextPage()} loading={isFetchingNextPage} style={{ marginTop: 16 }}>
          Load More
        </Button>
      )}

      <Modal
        title="Resolve Attendance Dispute"
        open={resolveModalOpen}
        onCancel={() => setResolveModalOpen(false)}
        footer={null}
      >
        <div style={{ marginBottom: 24 }}>
          <Text type="secondary">Student Reason:</Text>
          <div style={{ padding: 12, background: 'var(--ant-color-fill-alter)', borderRadius: 8, marginTop: 8 }}>
            <Text>{selectedDispute?.reason}</Text>
          </div>
        </div>

        <Form form={form} layout="vertical" onFinish={handleResolve}>
          <Form.Item name="resolution" label="Decision" rules={[{ required: true }]}>
            <Select options={[
              { label: 'Approve (Mark Excused)', value: 'APPROVED' },
              { label: 'Reject', value: 'REJECTED' }
            ]} />
          </Form.Item>
          <Form.Item name="review_notes" label="Review Notes (Optional)">
            <Input.TextArea rows={3} placeholder="Provide a reason for the decision..." />
          </Form.Item>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => setResolveModalOpen(false)}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={resolveMutation.isPending}>Submit Decision</Button>
          </div>
        </Form>
      </Modal>
    </div>
  );
}
