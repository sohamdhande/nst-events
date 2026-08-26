import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, App, theme, Typography } from 'antd';
import { useUpdateClub, UpdateClubPayload } from '../../../hooks/useUpdateClub';
import { ClubListItem } from '../../../hooks/useClubs';

const { Text } = Typography;

interface EditClubModalProps {
  open: boolean;
  onClose: () => void;
  club: ClubListItem | null;
}

export function EditClubModal({ open, onClose, club }: EditClubModalProps) {
  const [form] = Form.useForm();
  const { message } = App.useApp();
  const { mutateAsync: updateClub, isPending } = useUpdateClub();
  const { token } = theme.useToken();

  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const formBannerUrl = Form.useWatch('banner_url', form);
  
  const previewUrl = (formBannerUrl ?? club?.banner_url ?? '').trim();
  const imgError = previewUrl && failedUrl === previewUrl;

  useEffect(() => {
    if (open && club) {
      form.setFieldsValue({
        name: club.name,
        description: club.description || '',
        banner_url: club.banner_url || '',
      });
    }
  }, [open, club, form]);

  const handleCancel = () => {
    if (!isPending) {
      form.resetFields();
      onClose();
    }
  };

  const handleSubmit = async () => {
    if (!club) return;
    try {
      const values = await form.validateFields();
      const payload: UpdateClubPayload = {};

      if (values.name !== club.name) {
        payload.name = values.name;
      }

      const formDesc = values.description?.trim();
      const clubDesc = club.description || '';
      if (formDesc !== clubDesc) {
        payload.description = formDesc || null;
      }

      const formBanner = values.banner_url?.trim();
      const clubBanner = club.banner_url || '';
      if (formBanner !== clubBanner) {
        payload.banner_url = formBanner || null;
      }

      if (Object.keys(payload).length === 0) {
        handleCancel();
        return;
      }

      await updateClub({ id: club.id, payload });
      message.success('Club updated successfully');
      form.resetFields();
      onClose();
    } catch (err: unknown) {
      if (err instanceof Error) {
        if (err.message?.includes('duplicate') || err.message?.includes('conflict') || err.message?.includes('409')) {
          message.error('A club with this name already exists.');
        } else if (err.message?.includes('403') || err.message?.toLowerCase().includes('forbidden')) {
          message.error('You do not have permission to edit this club.');
        } else if (err.message?.includes('404')) {
          message.error('Club not found.');
        } else if (err.message?.includes('422') || err.message?.includes('validation')) {
          message.error('Invalid club data provided.');
        } else {
          if (err && typeof err === 'object' && 'errorFields' in err) {
            return;
          }
          message.error('Failed to update club.');
        }
      }
    }
  };

  const renderBannerPreview = () => {
    if (!previewUrl || imgError) {
      return (
        <div>
          <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>Current Banner</Typography.Text>
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
        </div>
      );
    }

    return (
      <div>
        <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>Current Banner</Typography.Text>
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
      </div>
    );
  };

  return (
    <Modal
      title="Edit Club"
      open={open}
      onCancel={handleCancel}
      onOk={handleSubmit}
      confirmLoading={isPending}
      okText="Save Changes"
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
          label="Club Banner"
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
        {renderBannerPreview()}
      </Form>
    </Modal>
  );
}
