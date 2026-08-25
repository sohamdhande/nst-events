'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCurrentUser } from '../../../../hooks/useCurrentUser';
import { useAdminUsers, useUpdateUserRole, useUpdateUserAcademicBatch, AdminUser } from '../../../../hooks/useUserManagement';
import { useAdminAcademicBatches } from '../../../../hooks/useAdminAcademicBatches';
import { Input, Button, Table, Badge, Modal, Select, Alert, Tag, Dropdown } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { AdminPageHeader } from '../../../../components/admin/AdminPageHeader';

export default function UserManagementPage() {
  const router = useRouter();
  const { data: currentUser, isLoading: isUserLoading } = useCurrentUser();
  
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modals state
  const [roleModalUser, setRoleModalUser] = useState<AdminUser | null>(null);
  const [selectedRole, setSelectedRole] = useState<'STUDENT' | 'FACULTY_ADMIN' | 'PLATFORM_ADMIN'>('STUDENT');

  const [batchModalUser, setBatchModalUser] = useState<AdminUser | null>(null);
  const [selectedBatchId, setSelectedBatchId] = useState<string | undefined>(undefined);

  const {
    data,
    isLoading: isUsersLoading,
    isError: isUsersError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
  } = useAdminUsers(searchQuery);

  const { data: batchesData, isLoading: isBatchesLoading } = useAdminAcademicBatches();

  const updateRole = useUpdateUserRole();
  const updateBatch = useUpdateUserAcademicBatch();

  if (!isUserLoading && (!currentUser || currentUser.global_role !== 'PLATFORM_ADMIN')) {
    router.replace('/dashboard');
    return null;
  }

  const users = data?.pages.flatMap(page => page.data) || [];

  const handleRoleChangeSubmit = () => {
    if (!roleModalUser) return;
    
    updateRole.mutate({
      userId: roleModalUser.id,
      payload: { role: selectedRole }
    }, {
      onSuccess: () => {
        setRoleModalUser(null);
      }
    });
  };

  const handleBatchChangeSubmit = () => {
    if (!batchModalUser || !selectedBatchId) return;

    updateBatch.mutate({
      userId: batchModalUser.id,
      batchId: selectedBatchId,
    }, {
      onSuccess: () => {
        setBatchModalUser(null);
      }
    });
  };

  const columns = [
    {
      title: 'Name',
      dataIndex: 'fullName',
      key: 'fullName',
      render: (text: string) => text ?? 'Unknown',
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: 'Role',
      dataIndex: 'globalRole',
      key: 'globalRole',
      render: (role: string) => {
        let status: 'success' | 'warning' | 'error' | 'default' = 'default';
        if (role === 'PLATFORM_ADMIN') status = 'error';
        if (role === 'FACULTY_ADMIN') status = 'warning';
        if (role === 'STUDENT') status = 'success';
        return <Badge status={status} text={role} />;
      },
    },
    {
      title: 'Program',
      dataIndex: 'academicProfile',
      key: 'program',
      render: (profile: AdminUser['academicProfile']) => profile ? <Tag color="blue">{profile.batch.program.code}</Tag> : <span className="text-gray-400">None</span>,
    },
    {
      title: 'Academic Batch',
      dataIndex: 'academicProfile',
      key: 'batch',
      render: (profile: AdminUser['academicProfile']) => profile ? `${profile.batch.admissionYear}–${profile.batch.graduationYear}` : '-',
    },
    {
      title: 'Assignment Source',
      dataIndex: 'academicProfile',
      key: 'assignmentSource',
      render: (profile: AdminUser['academicProfile']) => profile ? <Tag color={profile.assignmentSource === 'ADMIN' ? 'volcano' : 'green'}>{profile.assignmentSource}</Tag> : '-',
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: unknown, user: AdminUser) => {
        const isCurrentUser = user.id === currentUser?.id;
        
        const items = [
          {
            key: 'role',
            label: 'Change Role',
            disabled: isCurrentUser,
            onClick: () => {
              setRoleModalUser(user);
              setSelectedRole(user.globalRole);
              updateRole.reset();
            }
          },
          {
            key: 'batch',
            label: 'Change Academic Batch',
            onClick: () => {
              setBatchModalUser(user);
              setSelectedBatchId(user.academicProfile?.batchId);
              updateBatch.reset();
            }
          }
        ];

        return (
          <Dropdown menu={{ items }} trigger={['click']}>
            <Button size="small">Actions</Button>
          </Dropdown>
        );
      },
      align: 'right' as const,
    },
  ];

  return (
    <div className="max-w-6xl mx-auto">
      <AdminPageHeader
        breadcrumbs={[
          { title: 'Administration' },
          { title: 'Users & Roles' }
        ]}
        title="Users & Roles"
        description="Manage global roles and academic assignments."
        context={
          <Input
            placeholder="Search by Email or Name"
            prefix={<SearchOutlined className="text-gray-400" />}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: 250 }}
            allowClear
          />
        }
      />


      {isUsersError && !data ? (
        <Alert
          title="Failed to load users"
          type="error"
          showIcon
          style={{ marginBottom: 24 }}
        />
      ) : (
        <>
          <Table
            dataSource={users}
            columns={columns}
            rowKey="id"
            loading={isUserLoading || isUsersLoading}
            pagination={false}
            scroll={{ x: true }}
            locale={{ emptyText: 'No users found' }}
            style={{ marginBottom: 16 }}
          />
          
          {(hasNextPage || isFetchNextPageError) && (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              {isFetchNextPageError && (
                <Alert
                  title="Failed to load more users"
                  type="error"
                  showIcon
                  style={{ marginBottom: 16, display: 'inline-block' }}
                />
              )}
              {hasNextPage && (
                <Button onClick={() => fetchNextPage()} loading={isFetchingNextPage}>
                  Load More
                </Button>
              )}
            </div>
          )}
        </>
      )}

      {/* Role Change Modal */}
      <Modal
        title="Change User Role"
        open={!!roleModalUser}
        onOk={handleRoleChangeSubmit}
        onCancel={() => setRoleModalUser(null)}
        confirmLoading={updateRole.isPending}
        okButtonProps={{ disabled: selectedRole === roleModalUser?.globalRole }}
      >
        <div style={{ marginBottom: 16 }}>
          Select a new role for <strong>{roleModalUser?.fullName ?? 'Unknown'}</strong> ({roleModalUser?.email}).
        </div>
        
        <Select
          style={{ width: '100%' }}
          value={selectedRole}
          onChange={(value) => setSelectedRole(value)}
          options={[
            { value: 'STUDENT', label: 'STUDENT' },
            { value: 'FACULTY_ADMIN', label: 'FACULTY_ADMIN' },
            { value: 'PLATFORM_ADMIN', label: 'PLATFORM_ADMIN' },
          ]}
        />

        {updateRole.isError && (
          <Alert
            title="Failed to update role. Please try again."
            type="error"
            showIcon
            style={{ marginTop: 16 }}
          />
        )}
      </Modal>

      {/* Batch Change Modal */}
      <Modal
        title="Change Academic Batch"
        open={!!batchModalUser}
        onOk={handleBatchChangeSubmit}
        onCancel={() => setBatchModalUser(null)}
        confirmLoading={updateBatch.isPending}
        okButtonProps={{ disabled: !selectedBatchId || selectedBatchId === batchModalUser?.academicProfile?.batchId }}
      >
        <div style={{ marginBottom: 16 }}>
          Select a new academic batch for <strong>{batchModalUser?.fullName ?? 'Unknown'}</strong> ({batchModalUser?.email}).
        </div>

        <div style={{ marginBottom: 16 }}>
          <span className="text-gray-500">Current Assignment Source: </span>
          {batchModalUser?.academicProfile ? (
            <Tag color={batchModalUser.academicProfile.assignmentSource === 'ADMIN' ? 'volcano' : 'green'}>
              {batchModalUser.academicProfile.assignmentSource}
            </Tag>
          ) : 'None'}
        </div>
        
        <Select
          showSearch
          style={{ width: '100%' }}
          placeholder="Select an academic batch"
          value={selectedBatchId}
          onChange={(value) => setSelectedBatchId(value)}
          loading={isBatchesLoading}
          filterOption={(input, option) =>
            (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
          }
          options={(batchesData || []).map(b => ({
            label: b.display_name,
            value: b.id,
          }))}
        />

        <Alert
          title="Manual batch reassignment sets the assignment source to ADMIN. This will prevent automatic recalculation from clubs."
          type="info"
          showIcon
          style={{ marginTop: 16 }}
        />
        <p>This changes the user&apos;s current academic batch. Historical event records are not modified.</p>

        {updateBatch.isError && (
          <Alert
            title="Failed to update academic batch. Please try again."
            type="error"
            showIcon
            style={{ marginTop: 16 }}
          />
        )}
      </Modal>
    </div>
  );
}
