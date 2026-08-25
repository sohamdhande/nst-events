'use client';

import { use, useState, useMemo } from 'react';
import Link from 'next/link';
import { Card, Button, Alert, Typography, Table, Tag, Breadcrumb, Space, Select, Grid, Flex, Empty, theme } from 'antd';
import { useEventDetail } from '../../../../../hooks/useEventDetail';
import { useRegistrationsList, Registration } from '../../../../../hooks/useRegistrations';

const { Title, Text } = Typography;
const { useBreakpoint } = Grid;

export default function RegistrationsManagementPage({ params }: { params: Promise<{ id: string }> }) {
  const { token } = theme.useToken();
  const unwrappedParams = use(params);
  const eventId = unwrappedParams.id;
  
  const screens = useBreakpoint();
  const isMobile = !screens.md;

  const { data: event, isLoading: isEventLoading, isError: isEventError } = useEventDetail(eventId);
  
  const [filterStatus, setFilterStatus] = useState<string | undefined>(undefined);
  
  const { 
    data, 
    isLoading, 
    isError, 
    fetchNextPage, 
    hasNextPage, 
    isFetchingNextPage,
    refetch
  } = useRegistrationsList(eventId, filterStatus);


  const registrations = useMemo(() => {
    return data?.pages.flatMap(page => page.data) || [];
  }, [data]);

  if (isEventLoading) {
    return (
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>
        <Card loading variant="borderless" />
      </div>
    );
  }

  if (isEventError || !event) {
    return (
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>
        <Alert title="Error" description="Failed to load event." type="error" />
      </div>
    );
  }

  const columns = [
    {
      title: 'Participant',
      key: 'participant',
      render: (_: unknown, record: Registration) => (
        <Space direction="vertical" size={0}>
          <Text strong>{record.user.fullName || 'Unknown'}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{record.user.email}</Text>
        </Space>
      )
    },
    {
      title: 'Status',
      dataIndex: 'registrationStatus',
      key: 'status',
      render: (status: string) => {
        let color = 'default';
        if (status === 'REGISTERED') color = 'success';
        else if (status === 'WAITLISTED') color = 'warning';
        else if (status === 'CANCELLED') color = 'error';
        
        return <Tag color={color} style={{ margin: 0 }}>{status}</Tag>;
      }
    },
    {
      title: 'Registered At',
      dataIndex: 'registeredAt',
      key: 'registeredAt',
      render: (dateStr: string) => new Date(dateStr).toLocaleString(undefined, {
        month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
      })
    }
  ];

  const isEffectivelyLocked = event.isLocked;

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <Breadcrumb
        items={[
          { title: <Link href="/events">Events</Link> },
          { title: <Link href={`/events/${eventId}`}>{event.title}</Link> },
          { title: 'Registrations' },
        ]}
      />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <Space align="center" wrap>
          <Title level={2} style={{ margin: 0 }}>Registrations</Title>
          {isEffectivelyLocked && (
            <Tag color="red" bordered={false} style={{ fontSize: 14, padding: '4px 8px' }}>LOCKED — READ-ONLY</Tag>
          )}
        </Space>
      </div>

      <Card size="small" variant="borderless" styles={{ body: { padding: 16 } }}>
        <Space split={<Text type="secondary">|</Text>} wrap>
          <Text strong>Registered: <Text type="secondary" style={{ fontWeight: 'normal' }}>{event.registrationCount}</Text></Text>
          <Text strong>Capacity: <Text type="secondary" style={{ fontWeight: 'normal' }}>{event.maxCapacity ?? 'Unlimited'}</Text></Text>
          {event.maxCapacity !== null && (
            <Text strong>Available: <Text type="secondary" style={{ fontWeight: 'normal' }}>{Math.max(0, event.maxCapacity - event.registrationCount)}</Text></Text>
          )}
        </Space>
      </Card>

      <Card variant="borderless" styles={{ body: { padding: isMobile ? 12 : 0 } }}>
        <div style={{ padding: 16, borderBottom: `1px solid ${token.colorBorderSecondary}` }}>
          <Flex vertical={isMobile} gap="middle" wrap="wrap">
            <Select 
              placeholder="Filter Status" 
              allowClear 
              style={{ width: isMobile ? '100%' : 160 }}
              value={filterStatus}
              onChange={setFilterStatus}
              options={[
                { label: 'Registered', value: 'REGISTERED' },
                { label: 'Waitlisted', value: 'WAITLISTED' },
                { label: 'Cancelled', value: 'CANCELLED' }
              ]}
            />
            {filterStatus && <Button onClick={() => setFilterStatus(undefined)}>Clear filters</Button>}
          </Flex>
        </div>
      {isError ? (
        <Alert 
          title="Failed to load registrations" 
          type="error" 
          showIcon 
          action={<Button size="small" danger onClick={() => refetch()}>Retry</Button>}
        />
      ) : (
        <>
          {isMobile ? (
             isLoading ? (
               <Flex vertical gap="middle">
                 {[1, 2, 3].map(i => <Card key={i} loading />)}
               </Flex>
             ) : registrations.length === 0 ? (
               <Empty description={filterStatus ? "No registrations match your filters." : "No registrations yet."}>
                 {filterStatus && <Button onClick={() => setFilterStatus(undefined)}>Clear filters</Button>}
               </Empty>
             ) : (
               <Flex vertical gap="middle">
                 {registrations.map((record) => (
                   <Card 
                     key={record.id}
                     style={{ width: '100%' }} 
                     styles={{ body: { padding: 16 } }}
                   >
                     <Space orientation="vertical" size="small" style={{ width: '100%' }}>
                       <Space orientation="vertical" size={0}>
                         <Text strong>{record.user.fullName || 'Unknown'}</Text>
                         <Text type="secondary" style={{ fontSize: 12 }}>{record.user.email}</Text>
                       </Space>
                       
                       <Tag color={record.registrationStatus === 'REGISTERED' ? 'success' : record.registrationStatus === 'WAITLISTED' ? 'warning' : 'error'} style={{ margin: 0 }}>
                         {record.registrationStatus}
                       </Tag>
                       
                       <Text>{new Date(record.registeredAt).toLocaleString(undefined, {
                         month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
                       })}</Text>
                     </Space>
                   </Card>
                 ))}
               </Flex>
             )
          ) : (
            <Table
              dataSource={registrations}
              columns={columns}
              rowKey="id"
              pagination={false}
              loading={isLoading}
              size="small"
              locale={{ 
                emptyText: filterStatus ? (
                  <Empty description="No registrations match your filters.">
                    <Button onClick={() => setFilterStatus(undefined)}>Clear filters</Button>
                  </Empty>
                ) : 'No registrations yet.' 
              }}
            />
          )}
          {hasNextPage && (
            <div style={{ padding: 16, textAlign: 'center' }}>
              <Button onClick={() => fetchNextPage()} loading={isFetchingNextPage}>
                Load More
              </Button>
            </div>
          )}
        </>
      )}
      </Card>
    </div>
  );
}
