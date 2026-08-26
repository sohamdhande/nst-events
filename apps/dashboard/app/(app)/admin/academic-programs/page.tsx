'use client';

import { useState } from 'react';
import { Table, Button, Modal, Form, Input, Tag, App } from 'antd';
import { EditOutlined, PlusOutlined } from '@ant-design/icons';
import { useAdminAcademicPrograms, AdminAcademicProgram } from '../../../../hooks/useAdminAcademicPrograms';
import { AdminPageHeader } from '../../../../components/admin/AdminPageHeader';

export default function AcademicProgramsPage() {
  const { message } = App.useApp();
  const { data, isLoading, isError, createProgram, updateProgram } = useAdminAcademicPrograms();
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingProgram, setEditingProgram] = useState<AdminAcademicProgram | null>(null);
  const [form] = Form.useForm();

  const handleOpenCreate = () => {
    setEditingProgram(null);
    form.resetFields();
    setIsModalVisible(true);
  };

  const handleOpenEdit = (program: AdminAcademicProgram) => {
    setEditingProgram(program);
    form.setFieldsValue({
      name: program.name,
      code: program.code,
    });
    setIsModalVisible(true);
  };

  const handleModalSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (editingProgram) {
        await updateProgram.mutateAsync({
          id: editingProgram.id,
          data: values,
        });
        message.success('Program updated successfully');
      } else {
        await createProgram.mutateAsync(values);
        message.success('Program created successfully');
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
      title: 'Code',
      dataIndex: 'code',
      key: 'code',
      width: '150px',
      render: (text: string) => <Tag color="blue">{text}</Tag>,
    },
    {
      title: 'Program Name',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Batch Count',
      dataIndex: 'batchCount',
      key: 'batchCount',
      width: '120px',
    },
    {
      title: 'Actions',
      key: 'actions',
      width: '100px',
      render: (_: unknown, record: AdminAcademicProgram) => (
        <Button 
          type="text" 
          icon={<EditOutlined />} 
          onClick={() => handleOpenEdit(record)}
        >
          Edit
        </Button>
      ),
    },
  ];

  if (isError) {
    return (
      <div className="p-6">
        <div className="bg-red-50 text-red-600 p-4 rounded-md border border-red-200">
          Failed to load academic programs. Please try again.
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <AdminPageHeader
        breadcrumbs={[
          { title: 'Administration' },
          { title: 'Academic Programs' }
        ]}
        title="Academic Programs"
        description="Manage the academic program catalog."
        action={{
          label: 'Create Program',
          icon: <PlusOutlined />,
          onClick: handleOpenCreate,
        }}
      />

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
        <Table
          dataSource={data}
          columns={columns}
          rowKey="id"
          loading={isLoading}
          pagination={false}
          size="small"
        />
      </div>

      <Modal
        title={editingProgram ? 'Edit Academic Program' : 'Create Academic Program'}
        open={isModalVisible}
        onOk={handleModalSubmit}
        onCancel={() => setIsModalVisible(false)}
        confirmLoading={createProgram.isPending || updateProgram.isPending}
      >
        <Form form={form} layout="vertical" className="mt-4">
          <Form.Item
            name="name"
            label="Program Name"
            rules={[{ required: true, message: 'Please enter a program name' }]}
          >
            <Input placeholder="e.g., Bachelor of Technology" />
          </Form.Item>
          
          <Form.Item
            name="code"
            label="Program Code"
            rules={[
              { required: true, message: 'Please enter a program code' },
              { pattern: /^[A-Z0-9_-]+$/, message: 'Only uppercase letters, numbers, hyphens, and underscores' }
            ]}
          >
            <Input placeholder="e.g., BTECH" className="uppercase" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
