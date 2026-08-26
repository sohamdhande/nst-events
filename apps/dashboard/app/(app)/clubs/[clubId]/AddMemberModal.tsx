'use client';

import { useState } from 'react';
import { Modal, Form, Select, Input, message, Alert, Typography } from 'antd';
import { useAddClubMember } from '../../../../hooks/useClubDetail';

interface AddMemberModalProps {
  clubId: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function AddMemberModal({ clubId, isOpen, onClose }: AddMemberModalProps) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const addMemberMutation = useAddClubMember(clubId);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      await addMemberMutation.mutateAsync({
        user_id: values.user_id,
        role: values.role,
      });
      message.success('Member added successfully');
      form.resetFields();
      onClose();
    } catch (err: unknown) {
      console.error('Failed to add member:', err);
      if (err instanceof Error) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        message.error((err as any)?.data?.error || err.message || 'Failed to add member');
      } else {
        message.error('Failed to add member');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title="Add Club Member"
      open={isOpen}
      onOk={handleSubmit}
      onCancel={() => {
        form.resetFields();
        onClose();
      }}
      confirmLoading={loading}
      destroyOnClose
    >
      <Typography.Paragraph type="secondary" style={{ marginBottom: 16 }}>
        Enter the platform user ID provided by the user.
      </Typography.Paragraph>
      <Alert
        message="Name and email lookup is not available to Club Administrators in V1."
        type="info"
        showIcon
        style={{ marginBottom: 24 }}
      />
      <Form form={form} layout="vertical">
        <Form.Item
          name="user_id"
          label="Platform User ID"
          rules={[
            { required: true, message: 'Please enter the user ID' },
            { type: 'string', min: 36, max: 36, message: 'Must be a valid UUID' }
          ]}
        >
          <Input placeholder="Enter the user's platform ID (UUID)" />
        </Form.Item>
        <Form.Item
          name="role"
          label="Club Role"
          rules={[{ required: true, message: 'Please select a role' }]}
        >
          <Select placeholder="Select a club role">
            <Select.Option value="CLUB_ADMIN">Club Admin</Select.Option>
            <Select.Option value="FACULTY_MENTOR">Faculty Mentor</Select.Option>
            <Select.Option value="CORE_MEMBER">Core Member</Select.Option>
            <Select.Option value="MEMBER">Member</Select.Option>
          </Select>
        </Form.Item>
      </Form>
    </Modal>
  );
}
