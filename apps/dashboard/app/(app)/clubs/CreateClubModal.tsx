import React, { useState } from 'react';
import { Modal, Form, Input, Select, App, theme, Typography } from 'antd';
import { useCreateClub } from '../../../hooks/useCreateClub';
import { useAdminUsers } from '../../../hooks/useUserManagement';

const { Text } = Typography;

interface CreateClubModalProps {
  open: boolean;
  onClose: () => void;
}

export function CreateClubModal({ open, onClose }: CreateClubModalProps) {
  const [form] = Form.useForm();
  const { message } = App.useApp();
  const { mutateAsync: createClub, isPending } = useCreateClub();
  const { token } = theme.useToken();

  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const formBannerUrl = Form.useWatch('banner_url', form);
  
  const previewUrl = (formBannerUrl ?? '').trim();
  const imgError = previewUrl && failedUrl === previewUrl;

  const [searchTerm, setSearchTerm] = useState('');
  const { data: usersData, isLoading: isLoadingUsers } = useAdminUsers(searchTerm);

  const users = usersData?.pages.flatMap((page) => page.data) || [];

  const handleCancel = () => {
    if (!isPending) {
      form.resetFields();
      setSearchTerm('');
      onClose();
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      await createClub({
        name: values.name,
        description: values.description,
        initial_admin_id: values.initial_admin_id,
        banner_url: values.banner_url?.trim() || null,
      });
      message.success('Club created successfully');
      form.resetFields();
      setSearchTerm('');
      onClose();
    } catch (err: unknown) {
      // Form validation errors will be caught here silently, 
      // but API errors need to be displayed.
      if (err instanceof Error) {
        if (err.message?.includes('duplicate') || err.message?.includes('conflict') || err.message?.includes('ALREADY_EXISTS')) {
          message.error('A club with this name or code already exists.');
        } else if (err.message?.includes('403') || err.message?.toLowerCase().includes('forbidden')) {
          message.error('You do not have permission to create clubs.');
        } else if (err.message?.includes('422') || err.message?.includes('validation')) {
          message.error('Invalid club data provided.');
        } else {
          if (err && typeof err === 'object' && 'errorFields' in err) {
            return;
          }
          message.error(err.message || 'Failed to create club.');
        }
      }
    }
  };

  return (
    <Modal
      title="Create Club"
      open={open}
      onCancel={handleCancel}
      onOk={handleSubmit}
      confirmLoading={isPending}
      okText="Create Club"
      cancelText="Cancel"
      destroyOnHidden
    >
      <Form
        form={form}
        layout="vertical"
        disabled={isPending}
      >
        <Form.Item
          name="name"
          label="Club Name"
          rules={[{ required: true, message: 'Please enter the club name' }]}
        >
          <Input placeholder="e.g. AI & Robotics Club" />
        </Form.Item>

        <Form.Item
          name="description"
          label="Description"
        >
          <Input.TextArea rows={4} placeholder="Describe the club's purpose and activities..." />
        </Form.Item>

        <Form.Item
          name="banner_url"
          label="Club Banner (Optional)"
          extra="Recommended: 1600 × 400 px (4:1), JPG/PNG/WebP, up to 8 MB. Use a direct image URL, not a webpage or album link."
          rules={[
            { type: 'url', message: 'Please enter a valid HTTP/HTTPS URL' },
          ]}
        >
          <Input placeholder="https://cdn.example.com/club-banner.jpg" allowClear />
        </Form.Item>
        <div style={{
          backgroundColor: token.colorInfoBg,
          border: `1px solid ${token.colorInfoBorder}`,
          borderRadius: token.borderRadius,
          padding: '8px 12px',
          marginBottom: 16,
          fontSize: token.fontSizeSM,
        }}>
          <Typography.Text strong style={{ display: 'block', marginBottom: 4 }}>Banner Guidelines</Typography.Text>
          <ul style={{ margin: 0, paddingLeft: 20, color: token.colorText }}>
            <li>Recommended size: 1600 × 400 px</li>
            <li>Aspect ratio: 4:1</li>
            <li>Formats: JPG, PNG, WebP</li>
            <li>Maximum size: 8 MB</li>
            <li>Use a direct image URL (The URL should open the image itself)</li>
          </ul>
          <Typography.Text type="secondary" style={{ display: 'block', marginTop: 8, fontSize: token.fontSizeSM }}>
            NST Events stores the image URL and displays the image from its external host.
          </Typography.Text>
        </div>
        {(!previewUrl || imgError) ? (
          <div
            style={{
              height: 120,
              backgroundColor: token.colorFillQuaternary,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 8,
              marginBottom: 8,
            }}
          >
            <Text type="secondary">No Banner</Text>
          </div>
        ) : (
          <div
            style={{
              height: 120,
              backgroundImage: `url(${previewUrl})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              borderRadius: 8,
              marginBottom: 8,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt="Banner preview"
              style={{ display: 'none' }}
              onError={() => setFailedUrl(previewUrl)}
            />
          </div>
        )}

        <Form.Item
          name="initial_admin_id"
          label="Initial Admin"
          rules={[{ required: true, message: 'Please select an initial admin for the club' }]}
          extra="Only platform or faculty admins, or existing student users can be assigned."
        >
          <Select
            showSearch
            placeholder="Search for a user..."
            loading={isLoadingUsers}
            filterOption={false}
            onSearch={(value) => setSearchTerm(value)}
            options={users.map((user) => ({
              label: `${user.fullName || 'Unknown Name'} (${user.email}) - ${user.globalRole}`,
              value: user.id,
            }))}
            notFoundContent={isLoadingUsers ? 'Loading...' : 'No users found'}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}
