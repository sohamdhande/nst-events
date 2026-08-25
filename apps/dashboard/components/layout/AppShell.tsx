'use client';

import React, { useEffect, useState } from 'react';
import { Layout, Menu, Avatar, Space, Dropdown, Typography, theme as antdTheme } from 'antd';
import { 
  DashboardOutlined, 
  CalendarOutlined, 
  TeamOutlined, 
  BellOutlined, 
  UserOutlined,
  LogoutOutlined,
  CheckSquareOutlined,
  MonitorOutlined,
  FileTextOutlined,
  BgColorsOutlined,
  LaptopOutlined,
  SunOutlined,
  MoonOutlined,
  BookOutlined,
  BlockOutlined
} from '@ant-design/icons';
import { useRouter, usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { getWebAuthStore } from '../../lib/auth-store';
import { NotificationPopover } from '../notifications/NotificationPopover';
import { useRealtimeNotifications } from '../../hooks/useRealtimeNotifications';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;
const { useToken } = antdTheme;

function getPageTitle(pathname: string): string {
  const routeTitles: Record<string, string> = {
    '/dashboard': 'Dashboard',
    '/events': 'Events',
    '/clubs': 'Clubs',
    '/notifications': 'Notifications',
    '/profile': 'Profile',
    '/admin/approvals': 'Approvals',
    '/admin/users': 'Users & Roles',
    '/admin/academic-programs': 'Academic Programs',
    '/admin/academic-batches': 'Academic Batches',
    '/admin/audit-logs': 'Audit Logs',
    '/admin/queues': 'Queues',
  };

  // Exact match
  if (routeTitles[pathname]) return routeTitles[pathname];

  // Dynamic route patterns
  if (/^\/events\/[^/]+\/registrations$/.test(pathname)) return 'Registrations';
  if (/^\/events\/[^/]+\/teams$/.test(pathname)) return 'Teams';
  if (/^\/events\/[^/]+\/attendance$/.test(pathname)) return 'Attendance';
  if (/^\/events\/[^/]+\/edit$/.test(pathname)) return 'Edit Event';
  if (/^\/events\/[^/]+\/register$/.test(pathname)) return 'Register';
  if (/^\/events\/[^/]+$/.test(pathname)) return 'Event Detail';
  if (/^\/clubs\/[^/]+$/.test(pathname)) return 'Club Detail';
  if (/^\/admin\/users\/[^/]+$/.test(pathname)) return 'User Detail';

  // Fallback: capitalize first segment
  const segment = pathname.split('/').filter(Boolean)[0];
  return segment ? segment.charAt(0).toUpperCase() + segment.slice(1) : 'Dashboard';
}

function formatRoleDisplay(role?: string | null): string {
  if (!role) return '';
  const roleMap: Record<string, string> = {
    'PLATFORM_ADMIN': 'Platform Admin',
    'FACULTY_ADMIN': 'Faculty Admin',
    'FACULTY_MENTOR': 'Faculty Mentor',
    'CLUB_ADMIN': 'Club Admin',
    'CORE_MEMBER': 'Core Member',
    'STUDENT': 'Student',
  };
  return roleMap[role] || role.replace(/_/g, ' ');
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: currentUser } = useCurrentUser();
  const { theme, setTheme } = useTheme();
  const { token } = useToken();
  const [mounted, setMounted] = useState(false);

  // Initialize global real-time notifications
  useRealtimeNotifications();

  useEffect(() => {
    setMounted(true);
  }, []);

  const isPlatformAdmin = currentUser?.global_role === 'PLATFORM_ADMIN';
  const isFacultyAdmin = currentUser?.global_role === 'FACULTY_ADMIN';
  const isFacultyMentor = currentUser?.club_memberships?.some(m => m.role === 'FACULTY_MENTOR') ?? false;
  const isAdmin = isPlatformAdmin || isFacultyAdmin;
  const canApprove = isAdmin || isFacultyMentor;

  const handleLogout = () => {
    getWebAuthStore().logout();
    router.push('/login');
  };

  // OVERVIEW GROUP
  const overviewChildren = [
    { key: '/dashboard', icon: <DashboardOutlined />, label: 'Dashboard' },
    { key: '/events', icon: <CalendarOutlined />, label: 'Events' },
    { key: '/clubs', icon: <TeamOutlined />, label: 'Clubs' },
  ];

  const menuItems: any[] = [
    {
      type: 'group',
      label: <span style={{ color: token.colorTextSecondary, fontWeight: 600, fontSize: 11, letterSpacing: '0.05em' }}>OPERATIONS</span>,
      children: overviewChildren,
    }
  ];

  // ADMINISTRATION GROUP
  if (isAdmin || canApprove) {
    const adminChildren: { key: string; icon: React.ReactNode; label: string }[] = [];
    
    if (canApprove) {
      adminChildren.push({ key: '/admin/approvals', icon: <CheckSquareOutlined />, label: 'Approvals' });
    }
    
    if (isPlatformAdmin) {
      adminChildren.push({ key: '/admin/users', icon: <UserOutlined />, label: 'Users & Roles' });
      adminChildren.push({ key: '/admin/academic-programs', icon: <BookOutlined />, label: 'Academic Programs' });
      adminChildren.push({ key: '/admin/academic-batches', icon: <BlockOutlined />, label: 'Academic Batches' });
      adminChildren.push({ key: '/admin/audit-logs', icon: <FileTextOutlined />, label: 'Audit Logs' });
      adminChildren.push({ key: '/admin/queues', icon: <MonitorOutlined />, label: 'Queues' });
    }

    if (adminChildren.length > 0) {
      menuItems.push({
        type: 'group',
        label: <span style={{ color: token.colorTextSecondary, fontWeight: 600, fontSize: 11, letterSpacing: '0.05em', marginTop: 12, display: 'block' }}>ADMINISTRATION</span>,
        children: adminChildren,
      });
    }
  }

  // Determine active keys
  let selectedKeys = [pathname];
  if (pathname.startsWith('/events/')) selectedKeys = ['/events'];
  if (pathname.startsWith('/clubs/')) selectedKeys = ['/clubs'];
  if (pathname.startsWith('/admin/users/')) selectedKeys = ['/admin/users'];
  if (pathname.startsWith('/admin/academic-programs/')) selectedKeys = ['/admin/academic-programs'];
  if (pathname.startsWith('/admin/academic-batches/')) selectedKeys = ['/admin/academic-batches'];
  if (pathname.startsWith('/admin/audit-logs/')) selectedKeys = ['/admin/audit-logs'];
  if (pathname.startsWith('/admin/queues/')) selectedKeys = ['/admin/queues'];

  const themeMenu = mounted ? [
    {
      key: 'theme-group',
      label: 'Theme',
      type: 'group',
      children: [
        {
          key: 'theme-light',
          icon: <SunOutlined />,
          label: 'Light',
          onClick: () => setTheme('light'),
          style: { fontWeight: theme === 'light' ? 'bold' : 'normal' }
        },
        {
          key: 'theme-dark',
          icon: <MoonOutlined />,
          label: 'Dark',
          onClick: () => setTheme('dark'),
          style: { fontWeight: theme === 'dark' ? 'bold' : 'normal' }
        },
        {
          key: 'theme-system',
          icon: <LaptopOutlined />,
          label: 'System',
          onClick: () => setTheme('system'),
          style: { fontWeight: theme === 'system' ? 'bold' : 'normal' }
        }
      ]
    },
    { type: 'divider' }
  ] : [];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider 
        breakpoint="lg" 
        collapsedWidth="0"
        theme="dark"
        width={220}
        style={{ borderRight: `1px solid ${token.colorBorderSecondary}` }}
      >
        <div style={{ height: 48, display: 'flex', alignItems: 'center', padding: '0 16px', borderBottom: `1px solid ${token.colorBorderSecondary}` }}>
          <Text style={{ color: '#FFFFFF', fontWeight: 600, fontSize: 14, letterSpacing: -0.2 }}>NST Events</Text>
        </div>
        <Menu 
          theme="dark" 
          mode="inline" 
          selectedKeys={selectedKeys}
          onClick={({ key }) => router.push(key)}
          items={menuItems}
          style={{ padding: '8px 4px', borderRight: 0, background: 'transparent' }}
        />
      </Sider>
      <Layout>
        <Header style={{ 
          height: 48, 
          padding: '0 16px', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          borderBottom: `1px solid ${token.colorBorderSecondary}`, 
          lineHeight: '48px',
          background: token.colorBgContainer
        }}>
          <div style={{ color: token.colorText, fontWeight: 500, fontSize: 14 }}>
            {getPageTitle(pathname)}
          </div>
          <Space size="middle">
            <NotificationPopover />
            <Dropdown
              menu={{
                items: [
                  ...themeMenu,
                  {
                    key: 'logout',
                    icon: <LogoutOutlined />,
                    label: 'Sign Out',
                    danger: true,
                    onClick: handleLogout,
                  },
                ] as any,
              }}
              trigger={['click']}
            >
              <div 
                style={{ 
                  cursor: 'pointer', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 8, 
                  padding: '2px 8px', 
                  borderRadius: 4, 
                  transition: 'background 0.2s',
                  backgroundColor: 'transparent'
                }}
              >
                <div className="hidden sm:flex" style={{ flexDirection: 'column', lineHeight: 1.1, textAlign: 'right' }}>
                  <Text strong style={{ fontSize: 12, color: token.colorText }}>
                    {currentUser?.full_name || currentUser?.email}
                  </Text>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {formatRoleDisplay(currentUser?.global_role)}
                  </Text>
                </div>
                <Avatar size="small" icon={<UserOutlined />} src={currentUser?.avatar_url} style={{ backgroundColor: token.colorPrimary, marginLeft: 4 }} />
              </div>
            </Dropdown>
          </Space>
        </Header>
        <Content style={{ padding: '16px', overflow: 'auto' }}>
          {children}
        </Content>
      </Layout>
    </Layout>
  );
}
