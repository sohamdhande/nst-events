'use client';

import React, { useState } from 'react';
import { Typography, Select, Card, Row, Col, Statistic, Table, Tag, Empty, Button, Tabs, Badge } from 'antd';
import { CalendarOutlined, CheckCircleOutlined, UserOutlined, FileTextOutlined } from '@ant-design/icons';
import { CurrentUser, ClubMembership } from '../../../hooks/useCurrentUser';
import { useClubAnalytics } from '../../../hooks/useClubAnalytics';
import { useClubActivity } from '../../../hooks/useClubActivity';
import { useClubStudentLeaderboard } from '../../../hooks/useLeaderboard';
import { useApprovals, PendingEvent } from '../../../hooks/useApprovals';
import { useAttendanceDisputes, AttendanceDispute } from '../../../hooks/useAttendance';
import Link from 'next/link';

const { Title, Text } = Typography;

export function FacultyMentorDashboard({ currentUser }: { currentUser: CurrentUser }) {
  const mentorClubs = currentUser.club_memberships?.filter((m: ClubMembership) => m.role === 'FACULTY_MENTOR') || [];
  
  const [selectedClubId, setSelectedClubId] = useState<string | undefined>(
    mentorClubs.length > 0 ? mentorClubs[0].club_id : undefined
  );

  const { data: analytics, isLoading: isAnalyticsLoading } = useClubAnalytics(selectedClubId);
  const { data: activity, isLoading: isActivityLoading } = useClubActivity(selectedClubId);
  const { data: leaderboard, isLoading: isLeaderboardLoading } = useClubStudentLeaderboard(selectedClubId);
  
  // Pending Approvals specific to this club
  const { data: approvalsData, isLoading: isApprovalsLoading } = useApprovals(selectedClubId);
  const pendingApprovals = approvalsData?.data || [];

  // Attendance disputes specific to this club
  const { data: disputesData, isLoading: isDisputesLoading } = useAttendanceDisputes(undefined, selectedClubId);
  const disputes = disputesData?.pages.flatMap(p => p.data) || [];
  const pendingDisputesCount = disputes.filter(d => d.status === 'PENDING').length;

  if (mentorClubs.length === 0) {
    return (
      <Card>
        <Empty description="You are not assigned as a Faculty Mentor for any clubs." />
      </Card>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>Faculty Mentor Oversight</Title>
          <Text type="secondary">Monitor and oversee your assigned club activities</Text>
        </div>
        {mentorClubs.length > 1 && (
          <Select 
            value={selectedClubId} 
            onChange={setSelectedClubId} 
            style={{ width: 250 }}
            options={mentorClubs.map(c => ({ value: c.club_id, label: c.club_name || c.club_id }))}
          />
        )}
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} md={6}>
          <Card size="small" loading={isAnalyticsLoading}>
            <Statistic 
              title="Total Events" 
              value={analytics?.total_events || 0} 
              prefix={<CalendarOutlined />} 
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card size="small" loading={isAnalyticsLoading}>
            <Statistic 
              title="Avg Attendance Rate" 
              value={analytics?.attendance_rate || 0} 
              suffix="%" 
              prefix={<CheckCircleOutlined />} 
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card size="small" loading={isApprovalsLoading}>
            <Statistic 
              title="Pending Approvals" 
              value={pendingApprovals.length} 
              prefix={<FileTextOutlined />} 
              styles={{ content: { color: pendingApprovals.length > 0 ? '#faad14' : 'inherit' } }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card size="small" loading={isDisputesLoading}>
            <Statistic 
              title="Pending Disputes" 
              value={pendingDisputesCount} 
              prefix={<UserOutlined />} 
              styles={{ content: { color: pendingDisputesCount > 0 ? '#faad14' : 'inherit' } }}
            />
          </Card>
        </Col>
      </Row>

      <Card size="small">
        <Tabs 
          defaultActiveKey="approvals" 
          items={[
            {
              key: 'approvals',
              label: <Badge count={pendingApprovals.length} offset={[10, 0]} size="small">Pending Approvals</Badge>,
              children: (
                <Table
                  dataSource={pendingApprovals}
                  loading={isApprovalsLoading}
                  rowKey="id"
                  pagination={false}
                  size="small"
                  columns={[
                    { title: 'Event', dataIndex: 'title', key: 'title' },
                    { title: 'Submitted By', key: 'author', render: (_, r: PendingEvent & { author?: { fullName: string } }) => r.author?.fullName || 'Unknown' },
                    { 
                      title: 'Action', 
                      key: 'action', 
                      render: (_, r: PendingEvent) => <Link href={`/events/${r.id}`}><Button size="small" type="primary">Review</Button></Link> 
                    }
                  ]}
                  locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No events pending approval." /> }}
                />
              )
            },
            {
              key: 'disputes',
              label: <Badge count={pendingDisputesCount} offset={[10, 0]} size="small">Attendance Disputes</Badge>,
              children: (
                <Table
                  dataSource={disputes.filter(d => d.status === 'PENDING')}
                  loading={isDisputesLoading}
                  rowKey="id"
                  pagination={{ pageSize: 5 }}
                  size="small"
                  columns={[
                    { title: 'Student', key: 'student', render: (_, r: AttendanceDispute) => r.user?.fullName || r.userId },
                    { title: 'Reason', dataIndex: 'reason', key: 'reason', ellipsis: true },
                    { title: 'Event', key: 'event', render: (_, r: AttendanceDispute & { event?: { title: string } }) => r.event?.title || 'Unknown' },
                    { 
                      title: 'Action', 
                      key: 'action', 
                      render: (_, r: AttendanceDispute) => <Link href={`/events/${r.eventId}/attendance`}><Button size="small">Review</Button></Link> 
                    }
                  ]}
                  locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No pending disputes." /> }}
                />
              )
            },
            {
              key: 'leaderboard',
              label: 'Club Leaderboard',
              children: (
                <Table
                  dataSource={leaderboard?.data || []}
                  loading={isLeaderboardLoading}
                  rowKey="user_id"
                  pagination={{ pageSize: 10 }}
                  size="small"
                  columns={[
                    { title: 'Rank', key: 'rank', render: (_, __, idx) => idx + 1, width: 60 },
                    { title: 'Student', dataIndex: 'display_name', key: 'name' },
                    { title: 'Points', dataIndex: 'total_points', key: 'points', render: (val) => <Tag color="blue">{val}</Tag> }
                  ]}
                />
              )
            },
            {
              key: 'activity',
              label: 'Recent Activity',
              children: (
                <Table
                  dataSource={activity || []}
                  loading={isActivityLoading}
                  rowKey="id"
                  pagination={{ pageSize: 10 }}
                  size="small"
                  columns={[
                    { title: 'Time', dataIndex: 'created_at', key: 'time', render: (val) => new Date(val).toLocaleString() },
                    { title: 'Action', dataIndex: 'action', key: 'action', render: (val) => <Text strong>{val}</Text> },
                    { title: 'Actor', dataIndex: 'actor_name', key: 'actor' },
                  ]}
                  locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No recent activity." /> }}
                />
              )
            }
          ]}
        />
      </Card>
    </div>
  );
}
