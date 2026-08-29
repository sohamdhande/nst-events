'use client';

import { useState } from 'react';
import { Table, Button, Modal, Form, InputNumber, Select, message, Tag } from 'antd';
import { EditOutlined, PlusOutlined } from '@ant-design/icons';
import { useAdminAcademicBatches } from '../../../../hooks/useAdminAcademicBatches';
import { useAdminAcademicPrograms } from '../../../../hooks/useAdminAcademicPrograms';
import { AcademicBatch } from '../../../../hooks/useAcademicBatches';
import { useCurrentUser } from '../../../../hooks/useCurrentUser';
import { canManageAcademicCatalog } from '../../../../lib/auth-helpers';
import { AdminPageHeader } from '../../../../components/admin/AdminPageHeader';

export default function AcademicBatchesPage() {
  const { data: currentUser } = useCurrentUser();
  const { data, isLoading, isError, createBatch, updateBatch } = useAdminAcademicBatches();
  const { data: programsData, isLoading: isProgramsLoading } = useAdminAcademicPrograms();
  const canManage = canManageAcademicCatalog(currentUser);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingBatch, setEditingBatch] = useState<AcademicBatch | null>(null);
  const [form] = Form.useForm();

  const handleOpenCreate = () => {
    setEditingBatch(null);
    form.resetFields();
    setIsModalVisible(true);
  };

  const handleOpenEdit = (batch: AcademicBatch) => {
    setEditingBatch(batch);
    form.setFieldsValue({
      program_id: batch.program.id,
      admission_year: batch.admission_year,
      graduation_year: batch.graduation_year,
    });
    setIsModalVisible(true);
  };

  const handleModalSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (editingBatch) {
        await updateBatch.mutateAsync({
          id: editingBatch.id,
          data: {
            admission_year: values.admission_year,
            graduation_year: values.graduation_year,
          },
        });
        message.success('Batch updated successfully');
      } else {
        await createBatch.mutateAsync(values);
        message.success('Batch created successfully');
      }
      setIsModalVisible(false);
    } catch (err: unknown) {
      const error = err as { errorFields?: unknown; message?: string };
      if (error?.errorFields) return; // Form validation failed
      message.error(error?.message || 'Operation failed');
    }
  };

  const columns = [
    {
      title: 'Display Name',
      dataIndex: 'display_name',
      key: 'display_name',
      render: (text: string) => <strong className="text-gray-900 dark:text-gray-100">{text}</strong>,
    },
    {
      title: 'Program',
      dataIndex: ['program', 'code'],
      key: 'program',
      width: '150px',
      render: (text: string) => <Tag color="blue">{text}</Tag>,
    },
    {
      title: 'Admission Year',
      dataIndex: 'admission_year',
      key: 'admission_year',
      width: '150px',
    },
    {
      title: 'Graduation Year',
      dataIndex: 'graduation_year',
      key: 'graduation_year',
      width: '150px',
    },
    {
      title: 'Actions',
      key: 'actions',
      width: '100px',
      render: (_: unknown, record: AcademicBatch) => (
        canManage ? (
          <Button 
            type="text" 
            icon={<EditOutlined />} 
            onClick={() => handleOpenEdit(record)}
          >
            Edit
          </Button>
        ) : null
      ),
    },
  ];

  if (isError) {
    return (
      <div className="p-6">
        <div className="bg-red-50 text-red-600 p-4 rounded-md border border-red-200">
          Failed to load academic batches. Please try again.
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <AdminPageHeader
        breadcrumbs={[
          { title: 'Administration' },
          { title: 'Academic Batches' }
        ]}
        title="Academic Batches"
        description="Manage academic cohorts and their program mappings."
        action={canManage ? {
          label: 'Create Batch',
          icon: <PlusOutlined />,
          onClick: handleOpenCreate,
        } : undefined}
      />

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
        <Table
          dataSource={data}
          columns={columns}
          rowKey="id"
          loading={isLoading || isProgramsLoading}
          pagination={false}
          size="small"
        />
      </div>

      <Modal
        title={editingBatch ? 'Edit Academic Batch' : 'Create Academic Batch'}
        open={isModalVisible}
        onOk={handleModalSubmit}
        onCancel={() => setIsModalVisible(false)}
        confirmLoading={createBatch.isPending || updateBatch.isPending}
      >
        <Form form={form} layout="vertical" className="mt-4">
          <Form.Item
            name="program_id"
            label="Academic Program"
            rules={[{ required: true, message: 'Please select a program' }]}
          >
            <Select 
              placeholder="Select a program"
              disabled={!!editingBatch} // Cannot change program once created per spec
              options={(programsData || []).map(p => ({ label: `${p.name} (${p.code})`, value: p.id }))}
            />
          </Form.Item>
          
          <div className="flex space-x-4">
            <Form.Item
              name="admission_year"
              label="Admission Year"
              rules={[{ required: true, message: 'Please enter an admission year' }]}
              className="flex-1"
            >
              <InputNumber placeholder="e.g., 2024" className="w-full" min={2000} max={2100} />
            </Form.Item>

            <Form.Item
              name="graduation_year"
              label="Graduation Year"
              rules={[
                { required: true, message: 'Please enter a graduation year' },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue('admission_year') < value) {
                      return Promise.resolve();
                    }
                    return Promise.reject(new Error('Graduation year must be after admission year!'));
                  },
                }),
              ]}
              className="flex-1"
            >
              <InputNumber placeholder="e.g., 2028" className="w-full" min={2000} max={2100} />
            </Form.Item>
          </div>
        </Form>
      </Modal>
    </div>
  );
}
