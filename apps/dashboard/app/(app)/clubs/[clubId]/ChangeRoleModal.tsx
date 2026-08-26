'use client';

import { useState, useEffect } from 'react';
import { Modal, Form, Select, Typography, message } from 'antd';
import { useUpdateClubMemberRole, ClubMember } from '../../../../hooks/useClubDetail';

const { Text } = Typography;

interface ChangeRoleModalProps {
  clubId: string;
  member: ClubMember | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function ChangeRoleModal({ clubId, member, isOpen, onClose }: ChangeRoleModalProps) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const updateRoleMutation = useUpdateClubMemberRole(clubId, member?.user_id || '');

  useEffect(() => {
    if (isOpen && member) {
      form.setFieldsValue({ role: member.role });
    } else {
      form.resetFields();
    }
  }, [isOpen, member, form]);

  const handleSubmit = async () => {
    if (!member) return;
    try {
      const values = await form.validateFields();
      if (values.role === member.role) {
        onClose();
        return;
      }
      setLoading(true);
      await updateRoleMutation.mutateAsync({
        role: values.role,
      });
      message.success('Member role updated successfully');
      onClose();
    } catch (err: unknown) {
      if (err instanceof Error) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        message.error((err as any)?.data?.error || err.message || 'Failed to update role');
      } else {
        message.error('Failed to update role');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title="Change Club Role"
      open={isOpen}
      onOk={handleSubmit}
      onCancel={onClose}
      confirmLoading={loading}
      destroyOnClose
    >
      <div style={{ marginBottom: 24 }}>
        <Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>Updating role for: <Text strong>{member?.full_name}</Text></Text>
        <Text type="secondary" style={{ fontSize: 13 }}>This changes the member&apos;s role within this Club only.</Text>
      </div>
      <Form form={form} layout="vertical">
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
