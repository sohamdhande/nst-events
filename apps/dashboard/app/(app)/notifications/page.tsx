'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Typography, Button, Space, theme, Segmented, Table, Tag } from 'antd';
import { CheckOutlined } from '@ant-design/icons';
import { useNotifications, useReadNotification, useReadAllNotifications, Notification, NotificationsResponse } from '../../../hooks/useNotifications';
import { AdminPageHeader } from '../../../components/admin/AdminPageHeader';
import { getNotificationIcon, resolveNotificationTarget } from '../../../lib/notification-utils';
import { resolveManagementAction } from '../../../lib/action-utils';

const { Text } = Typography;
const { useToken } = theme;

export default function NotificationsPage() {
  const router = useRouter();
  const { token } = useToken();
  const [filterState, setFilterState] = useState<'All' | 'Unread'>('All');
  
  const { 
    data, 
    isLoading, 
    isError,
    fetchNextPage, 
    hasNextPage, 
    isFetchingNextPage 
  } = useNotifications(filterState === 'Unread' ? { filter_read: false } : undefined);
  
  const { mutate: markAsRead, isPending: isMarkingRead } = useReadNotification();
  const { mutate: markAllAsRead, isPending: isMarkingAllRead } = useReadAllNotifications();

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.readAt) {
      markAsRead(notification.id);
    }
    const target = resolveNotificationTarget(notification);
    if (target) {
      router.push(target);
    }
  };

  const notifications = data?.pages.flatMap((page: NotificationsResponse) => page.data) || [];

  const columns = [
    {
      title: 'Activity',
      key: 'activity',
      render: (_: unknown, record: Notification) => {
        const isUnread = !record.readAt;
        return (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ marginTop: 2, fontSize: 16 }}>
              {getNotificationIcon(record.type)}
            </div>
            <div>
              <Text strong={isUnread} style={{ display: 'block', fontSize: 14 }}>
                {record.title}
              </Text>
              {record.body && (
                <Text type="secondary" style={{ display: 'block', marginTop: 4, maxWidth: 600 }}>
                  {record.body}
                </Text>
              )}
            </div>
          </div>
        );
      },
    },
    {
      title: 'Type',
      key: 'type',
      width: 150,
      render: (_: unknown, record: Notification) => (
        <Tag>{record.type}</Tag>
      ),
    },
    {
      title: 'Time',
      key: 'time',
      width: 150,
      render: (_: unknown, record: Notification) => {
        const date = new Date(record.createdAt);
        return (
          <Space direction="vertical" size={0}>
            <Text>{date.toLocaleDateString()}</Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </Space>
        );
      },
    },
    {
      title: 'Status',
      key: 'status',
      width: 120,
      render: (_: unknown, record: Notification) => (
        record.readAt ? (
          <Text type="secondary" style={{ fontSize: 12 }}>Read</Text>
        ) : (
          <Tag color="processing">Unread</Tag>
        )
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 150,
      render: (_: unknown, record: Notification) => {
        // We only use the resolver to get the standardized label and target
        // We mock currentUserRoles since notifications page just handles the route based on notification metadata.
        const mockRoles = { isGlobalAdmin: true, isMentor: false, isClubAdmin: false, isCoreMember: false };
        const managementAction = resolveManagementAction({ type: 'NOTIFICATION', data: record, currentUserRoles: mockRoles });
        
        return (
          <Space>
            {managementAction?.href && (
              <Button size="small" onClick={(e) => { e.stopPropagation(); handleNotificationClick(record); }}>
                {managementAction.label}
              </Button>
            )}
            {!record.readAt && (
              <Button 
                size="small" 
                type="text" 
                icon={<CheckOutlined />} 
                onClick={(e) => { e.stopPropagation(); markAsRead(record.id); }}
                loading={isMarkingRead}
                aria-label="Mark Read"
              />
            )}
          </Space>
        );
      },
    }
  ];

  // Determine if we should show the "Mark all as read" button
  // We only show it if there's at least one unread notification in the current view
  const hasUnread = notifications.some(n => !n.readAt);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <AdminPageHeader
        title="Notifications"
        description="Review system, event, team, and operational activity."
        breadcrumbs={[
          { title: 'Dashboard' },
          { title: 'Notifications' },
        ]}
      />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Segmented 
          options={['All', 'Unread']} 
          value={filterState} 
          onChange={(value) => setFilterState(value as 'All' | 'Unread')} 
        />
        {hasUnread && (
          <Button 
            onClick={() => markAllAsRead()} 
            loading={isMarkingAllRead}
          >
            Mark all as read
          </Button>
        )}
      </div>

      <Table
        dataSource={notifications}
        columns={columns}
        rowKey="id"
        size="small"
        pagination={false}
        loading={isLoading}
        onRow={(record) => ({
          onClick: () => handleNotificationClick(record),
          style: { 
            cursor: resolveNotificationTarget(record) ? 'pointer' : 'default',
            backgroundColor: !record.readAt ? token.colorPrimaryBg : 'transparent',
          }
        })}
        locale={{
          emptyText: isError 
            ? "Unable to load notifications." 
            : filterState === 'Unread' 
              ? "No unread notifications." 
              : "No notifications."
        }}
      />

      {hasNextPage && (
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <Button onClick={() => fetchNextPage()} loading={isFetchingNextPage}>
            Load More
          </Button>
        </div>
      )}
    </div>
  );
}
