'use client';

import { useState } from 'react';

import { Table, Tag, Button, Modal } from 'antd';
import { useAuditLogs, AuditLog } from '../../../../hooks/useAuditLogs';
import { AdminPageHeader } from '../../../../components/admin/AdminPageHeader';
import { EyeOutlined } from '@ant-design/icons';

export default function AuditLogsPage() {
  const { data, isLoading, isError } = useAuditLogs();
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const columns = [
    {
      title: 'Time',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (text: string) => new Date(text).toLocaleString(),
      width: '180px',
    },
    {
      title: 'Action',
      dataIndex: 'action',
      key: 'action',
      render: (action: string) => (
        <Tag color={action.includes('DELETE') ? 'red' : action.includes('UPDATE') ? 'orange' : 'blue'}>
          {action}
        </Tag>
      ),
    },
    {
      title: 'Actor ID',
      dataIndex: 'actorId',
      key: 'actorId',
      render: (actorId: string | null) => actorId ? <span className="font-mono text-xs">{actorId}</span> : <Tag>SYSTEM</Tag>,
    },
    {
      title: 'Entity',
      dataIndex: 'entityType',
      key: 'entityType',
      width: '150px',
    },
    {
      title: 'Target ID',
      dataIndex: 'entityId',
      key: 'entityId',
      render: (entityId: string | null) => entityId ? <span className="font-mono text-xs">{entityId}</span> : '-',
    },
    {
      title: 'State',
      key: 'state',
      render: (_: unknown, record: AuditLog) => (
        <Button 
          type="text" 
          icon={<EyeOutlined />} 
          onClick={() => setSelectedLog(record)}
          disabled={!record.previousState && !record.newState}
        >
          View State
        </Button>
      ),
      width: '120px',
    }
  ];

  if (isError) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="bg-red-50 text-red-600 p-4 rounded-md border border-red-200">
          Failed to load audit logs. Please try again.
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <AdminPageHeader
        breadcrumbs={[
          { title: 'Administration' },
          { title: 'Audit Logs' }
        ]}
        title="Audit Logs"
        description="Review administrative and operational actions."
      />

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
        <Table
          dataSource={data?.data || []}
          columns={columns}
          rowKey="id"
          loading={isLoading}
          pagination={{ pageSize: 20 }}
          size="small"
        />
      </div>

      <Modal
        title={`Audit Log Details`}
        open={!!selectedLog}
        onCancel={() => setSelectedLog(null)}
        footer={[
          <Button key="close" onClick={() => setSelectedLog(null)}>
            Close
          </Button>
        ]}
        width={700}
      >
        {selectedLog && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <strong>Action:</strong> <Tag>{selectedLog.action}</Tag>
              </div>
              <div>
                <strong>Entity:</strong> {selectedLog.entityType} ({selectedLog.entityId || 'N/A'})
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-4">
              <div>
                <h4 className="font-semibold mb-2 text-gray-700">Previous State</h4>
                <pre className="bg-gray-100 p-3 rounded text-xs overflow-auto max-h-60 border border-gray-200">
                  {selectedLog.previousState 
                    ? JSON.stringify(selectedLog.previousState, null, 2) 
                    : <span className="text-gray-400 italic">No previous state recorded</span>}
                </pre>
              </div>
              <div>
                <h4 className="font-semibold mb-2 text-gray-700">New State</h4>
                <pre className="bg-blue-50 p-3 rounded text-xs overflow-auto max-h-60 border border-blue-200">
                  {selectedLog.newState 
                    ? JSON.stringify(selectedLog.newState, null, 2) 
                    : <span className="text-gray-400 italic">No new state recorded</span>}
                </pre>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
