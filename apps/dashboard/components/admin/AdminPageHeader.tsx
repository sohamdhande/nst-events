import React from 'react';
import { Breadcrumb, Button, Typography, Space } from 'antd';
import Link from 'next/link';

const { Title, Text } = Typography;

export interface AdminPageHeaderProps {
  breadcrumbs: { title: string; href?: string }[];
  title: string;
  description: string;
  action?: {
    label: string;
    icon?: React.ReactNode;
    onClick: () => void;
    type?: 'primary' | 'default';
  };
  context?: React.ReactNode;
}

export function AdminPageHeader({
  breadcrumbs,
  title,
  description,
  action,
  context,
}: AdminPageHeaderProps) {
  return (
    <div className="mb-6 space-y-4">
      <Breadcrumb
        items={breadcrumbs.map((bc, index) => ({
          title: bc.href ? <Link href={bc.href}>{bc.title}</Link> : bc.title,
          key: index,
        }))}
      />
      
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <Title level={2} style={{ margin: 0, fontSize: '24px', fontWeight: 600, letterSpacing: '-0.02em' }}>
            {title}
          </Title>
          <Text type="secondary" className="block mt-1">
            {description}
          </Text>
        </div>
        
        <Space>
          {context}
          {action && (
            <Button
              type={action.type || 'primary'}
              icon={action.icon}
              onClick={action.onClick}
            >
              {action.label}
            </Button>
          )}
        </Space>
      </div>
    </div>
  );
}
