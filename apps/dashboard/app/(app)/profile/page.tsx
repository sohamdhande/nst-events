'use client';

import React from 'react';
import { Card, Skeleton, Alert, Button, Typography, Row, Col, Avatar, Tag, Descriptions } from 'antd';
import { UserOutlined, LogoutOutlined } from '@ant-design/icons';
import { useCurrentUser } from '../../../hooks/useCurrentUser';
import { useLogout } from '../../../hooks/useLogout';

const { Title, Text, Paragraph } = Typography;

export default function ProfilePage() {
  const { data: user, isLoading, isError, error, refetch } = useCurrentUser();
  const { mutate: logout, isPending: isLoggingOut } = useLogout();

  if (isLoading) {
    return (
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        <Title level={2}>My Profile</Title>
        <Row gutter={[24, 24]}>
          <Col xs={24} md={12}>
            <Card title="Personal Details">
              <Skeleton active avatar paragraph={{ rows: 2 }} />
            </Card>
          </Col>
          <Col xs={24} md={12}>
            <Card title="Account Actions">
              <Skeleton active paragraph={{ rows: 1 }} />
            </Card>
          </Col>
        </Row>
      </div>
    );
  }

  if (isError || !user) {
    return (
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        <Alert
          title="Failed to load profile"
          description={error?.message || "We couldn't retrieve your profile at this time."}
          type="error"
          showIcon
          action={
            <Button size="small" danger onClick={() => refetch()}>
              Retry
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <Title level={2} style={{ margin: 0 }}>My Profile</Title>
        <Text type="secondary">View your personal details and manage your account.</Text>
      </div>

      <Row gutter={[24, 24]}>
        {/* Personal Details Card */}
        <Col xs={24} md={12}>
          <Card title="Personal Details" style={{ height: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
              <Avatar size={64} icon={<UserOutlined />} src={user.avatar_url} />
              <div>
                <Title level={4} style={{ margin: 0 }}>
                  {user.full_name || 'Set your name'}
                </Title>
                <Text type="secondary">{user.email}</Text>
              </div>
            </div>

            <Descriptions column={1} layout="vertical" size="small">
              <Descriptions.Item label="Account Role">
                <Tag color="blue">{user.global_role}</Tag>
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>

        {/* Account Actions Card */}
        <Col xs={24} md={12}>
          <Card title="Account Actions" style={{ height: '100%' }}>
            <Paragraph type="secondary">
              Sign out of your account on this device. You will need to sign in again to access your events.
            </Paragraph>
            <Button 
              danger 
              icon={<LogoutOutlined />}
              onClick={() => logout()}
              loading={isLoggingOut}
            >
              Sign Out
            </Button>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
