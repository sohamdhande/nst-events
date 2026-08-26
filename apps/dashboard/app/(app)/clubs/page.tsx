'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useClubs } from '../../../hooks/useClubs';
import { useCurrentUser } from '../../../hooks/useCurrentUser';
import { Card, Input, Typography, Tag, Space, Alert, Skeleton, Row, Col, Empty, Button, theme, Dropdown } from 'antd';
import { SearchOutlined, TeamOutlined, CalendarOutlined, PlusOutlined, MoreOutlined, EditOutlined } from '@ant-design/icons';
import { CreateClubModal } from './CreateClubModal';
import { EditClubModal } from './EditClubModal';
import { ClubListItem } from '../../../hooks/useClubs';

const { Title, Text, Paragraph } = Typography;

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);
  return debouncedValue;
}

export default function ClubsDirectoryPage() {
  const { data: currentUser } = useCurrentUser();
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingClub, setEditingClub] = useState<ClubListItem | null>(null);
  const { token } = theme.useToken();

  const { data, isLoading, error, refetch } = useClubs(debouncedSearchTerm);

  const isPlatformAdmin = currentUser?.global_role === 'PLATFORM_ADMIN';
  const isFacultyAdmin = currentUser?.global_role === 'FACULTY_ADMIN';

  const canEditClub = (clubId: string) => {
    if (isPlatformAdmin || isFacultyAdmin) return true;
    return currentUser?.club_memberships.some(
      (m) => m.club_id === clubId && m.role === 'CLUB_ADMIN'
    ) ?? false;
  };

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <Title level={2} style={{ margin: 0 }}>Clubs Directory</Title>
          <Text type="secondary">View all clubs on the platform.</Text>
        </div>
        {isPlatformAdmin && (
          <Button 
            type="primary" 
            icon={<PlusOutlined />} 
            onClick={() => setIsCreateModalOpen(true)}
          >
            Create Club
          </Button>
        )}
      </div>

      <div style={{ marginBottom: 24, maxWidth: 400 }}>
        <Input
          size="large"
          placeholder="Search clubs..."
          prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          allowClear
        />
      </div>

      {error ? (
        <Alert
          title="Failed to load clubs"
          description={error instanceof Error ? error.message : 'An unknown error occurred.'}
          type="error"
          showIcon
          action={
            <Button size="small" danger onClick={() => refetch()}>
              Retry
            </Button>
          }
          style={{ marginBottom: 24 }}
        />
      ) : isLoading ? (
        <Row gutter={[24, 24]}>
          {Array.from({ length: 6 }).map((_, i) => (
            <Col xs={24} md={12} lg={8} key={i}>
              <Card>
                <Skeleton active avatar={{ shape: 'square', size: 64 }} paragraph={{ rows: 2 }} />
              </Card>
            </Col>
          ))}
        </Row>
      ) : !data?.data || data.data.length === 0 ? (
        <Empty
          description={
            debouncedSearchTerm
              ? `No clubs found matching "${debouncedSearchTerm}".`
              : isPlatformAdmin 
                ? 'No clubs available. Create your first club.' 
                : 'There are no clubs available yet.'
          }
        >
          {isPlatformAdmin && !debouncedSearchTerm && (
            <Button type="primary" onClick={() => setIsCreateModalOpen(true)}>
              Create Club
            </Button>
          )}
        </Empty>
      ) : (
        <Row gutter={[24, 24]}>
          {data.data.map((club) => (
            <Col xs={24} md={12} lg={8} key={club.id}>
              <Card
                hoverable
                onClick={() => router.push(`/clubs/${club.id}`)}
                style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
                styles={{ body: { flex: 1, display: 'flex', flexDirection: 'column', padding: 0 } }}
              >
                {club.banner_url ? (
                  <div
                    style={{
                      height: 120,
                      backgroundImage: `url(${club.banner_url})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      borderTopLeftRadius: 8,
                      borderTopRightRadius: 8,
                    }}
                  />
                ) : (
                  <div
                    style={{
                      height: 120,
                      backgroundColor: token.colorFillQuaternary,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderTopLeftRadius: 8,
                      borderTopRightRadius: 8,
                    }}
                  >
                    <Text type="secondary">No Banner</Text>
                  </div>
                )}

                <div style={{ padding: 24, flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <Title level={5} style={{ marginTop: 0 }}>{club.name}</Title>
                  <Paragraph type="secondary" ellipsis={{ rows: 2 }} style={{ flex: 1 }}>
                    {club.description || 'No description provided.'}
                  </Paragraph>

                  <div style={{ marginTop: 16, borderTop: '1px solid #f0f0f0', paddingTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Tag
                      color={
                        club.status === 'ACTIVE' ? 'success' : club.status === 'INACTIVE' ? 'warning' : 'error'
                      }
                    >
                      {club.status}
                    </Tag>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <Space size="middle" style={{ fontSize: 12, color: '#8c8c8c' }}>
                        <Space size="small">
                          <CalendarOutlined />
                          <span>{club.event_count} Events</span>
                        </Space>
                        <Space size="small">
                          <TeamOutlined />
                          <span>{club.member_count} Members</span>
                        </Space>
                      </Space>
                      {canEditClub(club.id) && (
                        <div onClick={(e) => e.stopPropagation()}>
                          <Dropdown
                            menu={{
                              items: [
                                {
                                  key: 'edit',
                                  label: 'Edit Club',
                                  icon: <EditOutlined />,
                                  onClick: () => setEditingClub(club),
                                },
                              ],
                            }}
                            trigger={['click']}
                          >
                            <Button type="text" icon={<MoreOutlined />} aria-label="Club Actions" />
                          </Dropdown>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      )}

      {isPlatformAdmin && (
        <CreateClubModal 
          open={isCreateModalOpen} 
          onClose={() => setIsCreateModalOpen(false)} 
        />
      )}
      <EditClubModal
        open={!!editingClub}
        onClose={() => setEditingClub(null)}
        club={editingClub}
      />
    </div>
  );
}
