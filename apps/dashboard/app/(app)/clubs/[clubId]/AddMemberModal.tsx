'use client';

import { useState, useEffect } from 'react';
import { Modal, Form, Select, Input, App, Alert, Typography } from 'antd';
import { useAddClubMember } from '../../../../hooks/useClubDetail';
import { useCurrentUser } from '../../../../hooks/useCurrentUser';
import { canViewStudentDirectory } from '../../../../lib/auth-helpers';
import { useAdminUsers } from '../../../../hooks/useUserManagement';

interface AddMemberModalProps {
  clubId: string;
  isOpen: boolean;
  onClose: () => void;
}

function UserSearchSelect(props: React.ComponentProps<typeof Select>) {
  const [searchValue, setSearchValue] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchValue);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchValue]);

  const { data: usersData, isLoading: usersLoading } = useAdminUsers(debouncedSearch, undefined);

  return (
    <Select
      {...props}
      showSearch
      placeholder="Search by name or email"
      loading={usersLoading}
      onSearch={(val) => setSearchValue(val)}
      filterOption={false}
      options={(usersData?.pages?.[0]?.data || []).map((user) => ({
        label: `${user.fullName || 'Unknown'} (${user.email})`,
        value: user.id,
      }))}
    />
  );
}

export default function AddMemberModal({ clubId, isOpen, onClose }: AddMemberModalProps) {
  const [form] = Form.useForm();
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const addMemberMutation = useAddClubMember(clubId);
  const { data: currentUser } = useCurrentUser();
  const canSearch = canViewStudentDirectory(currentUser);

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
      destroyOnHidden
    >
      <Typography.Paragraph type="secondary" style={{ marginBottom: 16 }}>
        {canSearch ? "Search for a user by name or email, or enter their platform ID." : "Enter the platform user ID provided by the user."}
      </Typography.Paragraph>
      {!canSearch && (
        <Alert
          title="Name and email lookup is not available to Club Administrators in V1."
          type="info"
          showIcon
          style={{ marginBottom: 24 }}
        />
      )}
      <Form form={form} layout="vertical">
        {canSearch ? (
          <Form.Item
            name="user_id"
            label="User"
            rules={[{ required: true, message: 'Please select a user' }]}
          >
            <UserSearchSelect />
          </Form.Item>
        ) : (
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
        )}
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
