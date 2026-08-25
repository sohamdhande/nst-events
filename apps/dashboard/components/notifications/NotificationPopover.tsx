'use client';

import React from 'react';
import { Popover, List, Typography, Space, Button, Skeleton, theme, Badge } from 'antd';
import { BellOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { useNotifications, useReadNotification, useUnreadCount, Notification } from '../../hooks/useNotifications';
import { getNotificationIcon } from '../../lib/notification-utils';
import { resolveManagementAction } from '../../lib/action-utils';

const { Text } = Typography;
const { useToken } = theme;

export function NotificationPopover() {
  const router = useRouter();
  const { token } = useToken();
  const { data, isLoading, isError } = useNotifications();
  const { mutate: markAsRead } = useReadNotification();
  const { data: unreadData, isError: isUnreadError } = useUnreadCount();

  const notifications = data?.pages[0]?.data.slice(0, 5) || [];

  const handleNotificationClick = (notification: Notification, targetHref?: string | null) => {
    if (!notification.readAt) {
      markAsRead(notification.id);
    }
    if (targetHref) {
      router.push(targetHref);
    }
  };

  const content = (
    <div style={{ width: 320, maxHeight: 400, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '12px 16px', borderBottom: `1px solid ${token.colorBorderSecondary}` }}>
        <Text strong>Notifications</Text>
      </div>
      
      <div style={{ flex: 1, overflowY: 'auto', padding: '0' }}>
        {isLoading && (
          <div style={{ padding: 16 }}>
            <Skeleton active avatar title={false} paragraph={{ rows: 2 }} />
            <Skeleton active avatar title={false} paragraph={{ rows: 2 }} />
          </div>
        )}
        
        {isError && (
          <div style={{ padding: 16, textAlign: 'center' }}>
            <Text type="danger">Notifications unavailable.</Text>
          </div>
        )}

        {!isLoading && !isError && notifications.length === 0 && (
          <div style={{ padding: '24px 16px', textAlign: 'center' }}>
            <Text type="secondary">No notifications.</Text>
          </div>
        )}

        {!isLoading && !isError && notifications.length > 0 && (
          <List
            dataSource={notifications}
            renderItem={(item) => {
              const isUnread = !item.readAt;
              const date = new Date(item.createdAt);
              
              const mockRoles = { isGlobalAdmin: true, isMentor: false, isClubAdmin: false, isCoreMember: false };
              const action = resolveManagementAction({ type: 'NOTIFICATION', data: item, currentUserRoles: mockRoles });
              const target = action?.href;
              
              return (
                <List.Item
                  style={{
                    padding: '12px 16px',
                    cursor: target ? 'pointer' : 'default',
                    backgroundColor: isUnread ? token.colorPrimaryBg : 'transparent',
                    borderBottom: `1px solid ${token.colorBorderSecondary}`,
                    transition: 'background-color 0.2s',
                  }}
                  onClick={() => handleNotificationClick(item, target)}
                >
                  <List.Item.Meta
                    avatar={<div style={{ marginTop: 2 }}>{getNotificationIcon(item.type)}</div>}
                    title={
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                        <Text 
                          strong={isUnread} 
                          style={{ 
                            fontSize: 13, 
                            lineHeight: 1.4,
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden'
                          }}
                        >
                          {item.title || item.body}
                        </Text>
                      </div>
                    }
                    description={
                      <div style={{ marginTop: 4 }}>
                        {item.title && (
                          <Text 
                            type="secondary" 
                            style={{ 
                              fontSize: 12, 
                              display: '-webkit-box',
                              WebkitLineClamp: 1,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden'
                            }}
                          >
                            {item.body}
                          </Text>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                          <Text type="secondary" style={{ fontSize: 11 }}>
                            {date.toLocaleDateString()} {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </Text>
                          {action?.actionable && (
                            <Text type="secondary" style={{ fontSize: 11, color: token.colorPrimary }}>
                              {action.label} &rarr;
                            </Text>
                          )}
                        </div>
                      </div>
                    }
                  />
                </List.Item>
              );
            }}
          />
        )}
      </div>

      <div style={{ padding: '8px 16px', borderTop: `1px solid ${token.colorBorderSecondary}`, textAlign: 'center' }}>
        <Button type="link" onClick={() => router.push('/notifications')} style={{ fontSize: 13 }}>
          View All Notifications
        </Button>
      </div>
    </div>
  );

  return (
    <Popover
      content={content}
      trigger="click"
      placement="bottomRight"
      overlayInnerStyle={{ padding: 0 }}
      arrow={false}
    >
      <Badge count={isUnreadError ? 0 : (unreadData?.unread_count || 0)} size="small" offset={[-4, 4]}>
        <Button 
          type="text" 
          icon={<BellOutlined />} 
          aria-label="Notifications"
          style={{ fontSize: 16 }}
        />
      </Badge>
    </Popover>
  );
}
