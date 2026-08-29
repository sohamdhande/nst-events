'use client';

import React, { useState } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useCurrentUser } from '../../../../hooks/useCurrentUser';
import { useAdminUsers, useUpdateUserRole, useUpdateUserAcademicBatch, AdminUser, useProvisionUser, useRevokeUserSessions } from '../../../../hooks/useUserManagement';
import { useAdminAcademicBatches } from '../../../../hooks/useAdminAcademicBatches';
import { useAdminStudents, useAddStudent, useRemoveStudent, useImportStudents, AuthorizedStudent } from '../../../../hooks/useAdminStudents';
import { useClubs } from '../../../../hooks/useClubs';
import { Input, Button, Table, Badge, Modal, Select, Tag, Dropdown, Tabs, Upload, App, Skeleton, Result, Tooltip, Popover } from 'antd';
import { SearchOutlined, UploadOutlined, ExclamationCircleOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { AdminPageHeader } from '../../../../components/admin/AdminPageHeader';
import { 
  canViewStudentDirectory, 
  canManageStudentDirectory, 
  canRevokeUserSessions, 
  canChangeAcademicBatch,
  canChangeGlobalRole,
  canViewTargetClub
} from '../../../../lib/auth-helpers';

const ROLE_OPTIONS = [
  { value: 'STUDENT', label: 'Student' },
  { value: 'FACULTY_MENTOR', label: 'Faculty Mentor' },
  { value: 'FACULTY_ADMIN', label: 'Faculty Admin' },
  { value: 'PLATFORM_ADMIN', label: 'Platform Admin' }
];

export default function UserManagementPage() {
  const { message } = App.useApp();
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  
  const { data: currentUser, isLoading: isUserLoading } = useCurrentUser();
  
  // URL State Sync
  const activeTab = searchParams.get('tab') || 'students';
  const searchQuery = searchParams.get('q') || '';
  const statusFilter = searchParams.get('status') || undefined;
  const roleFilter = searchParams.get('role') || 'ALL';
  
  // Modals state
  const [roleModalUser, setRoleModalUser] = useState<AdminUser | null>(null);
  const [selectedRole, setSelectedRole] = useState<'STUDENT' | 'FACULTY_MENTOR' | 'FACULTY_ADMIN' | 'PLATFORM_ADMIN'>('STUDENT');
  const [batchModalUser, setBatchModalUser] = useState<AdminUser | null>(null);
  const [selectedBatchId, setSelectedBatchId] = useState<string | undefined>(undefined);

  const [addUserModalOpen, setAddUserModalOpen] = useState(false);
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminGlobalRole, setNewAdminGlobalRole] = useState<'FACULTY_MENTOR' | 'FACULTY_ADMIN' | 'PLATFORM_ADMIN'>('FACULTY_MENTOR');
  const [newAdminClubId, setNewAdminClubId] = useState<string | undefined>(undefined);

  const [addStudentModalOpen, setAddStudentModalOpen] = useState(false);
  const [newStudentEmail, setNewStudentEmail] = useState('');
  
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<{ added: number, already_present: number, errors: string[] } | null>(null);

  // Queries
  const { data: usersData, isLoading: isUsersLoading, fetchNextPage, hasNextPage, isFetchingNextPage, error: usersError } = useAdminUsers(searchQuery, activeTab === 'admin-roles' ? 'administrators' : undefined);
  const { data: batchesData, isLoading: isBatchesLoading } = useAdminAcademicBatches();
  const { data: studentsData, isLoading: isStudentsLoading, error: studentsError } = useAdminStudents(searchQuery, statusFilter);
  const { data: clubsData, isLoading: isClubsLoading } = useClubs();

  // Mutations
  const updateRole = useUpdateUserRole();
  const updateBatch = useUpdateUserAcademicBatch();
  const addStudent = useAddStudent();
  const removeStudent = useRemoveStudent();
  const importStudents = useImportStudents();
  const provisionUser = useProvisionUser();
  const revokeSessions = useRevokeUserSessions();

  // Navigation Helper
  const setParam = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`${pathname}?${params.toString()}`);
  };

  // Auth Gate
  if (!isUserLoading && !canViewStudentDirectory(currentUser)) {
    return (
      <div className="max-w-6xl mx-auto py-12">
        <Result
          status="403"
          title="Permission Denied"
          subTitle="You do not have permission to view Users & Roles."
        />
      </div>
    );
  }

  const isPlatformAdmin = canManageStudentDirectory(currentUser);

  const rawUsers = usersData?.pages.flatMap(page => page.data) || [];
  
  // Client-side role filtering for Admin Roles tab
  const users = rawUsers.filter(user => {
    if (roleFilter === 'ALL') return true;
    if (roleFilter === 'CLUB_ADMIN') return user.clubMemberships && user.clubMemberships.length > 0;
    return user.globalRole === roleFilter;
  });
  
  const platformAdminCount = usersData?.pages?.[0]?.platform_admin_count ?? 0;

  const students = studentsData?.data || [];

  const handleRoleChangeSubmit = () => {
    if (!roleModalUser) return;
    
    // Explicit confirmation for PLATFORM_ADMIN
    if (roleModalUser.globalRole === 'PLATFORM_ADMIN' && selectedRole !== 'PLATFORM_ADMIN') {
      Modal.confirm({
        title: 'Demote Platform Admin?',
        icon: <ExclamationCircleOutlined className="text-red-500" />,
        content: 'This changes the user\'s platform-wide permissions. It does not change their Club memberships or Club roles.',
        okText: 'Yes, Demote',
        okType: 'danger',
        cancelText: 'Cancel',
        onOk: () => submitRoleChange()
      });
    } else {
      submitRoleChange();
    }
  };

  const submitRoleChange = () => {
    if (!roleModalUser) return;
    updateRole.mutate({ userId: roleModalUser.id, payload: { role: selectedRole } }, { 
      onSuccess: () => {
        message.success('Global role updated');
        setRoleModalUser(null);
      },
      onError: (err: unknown) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const errorMsg = (err as any).response?.data?.error || (err as any).message;
        if (errorMsg === 'LAST_PLATFORM_ADMIN') {
          message.error('This Platform Admin cannot be removed because at least one Platform Admin must remain active.');
        } else {
          message.error('Failed to change role: ' + errorMsg);
        }
      }
    });
  };

  const handleBatchChangeSubmit = () => {
    if (!batchModalUser || !selectedBatchId) return;
    updateBatch.mutate({ userId: batchModalUser.id, batchId: selectedBatchId }, { 
      onSuccess: () => {
        message.success('Academic batch updated');
        setBatchModalUser(null);
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      onError: (err: unknown) => message.error((err as any).response?.data?.error || 'Failed to update batch')
    });
  };

  const handleAddUserSubmit = () => {
    let payload;
    if (newAdminEmail.endsWith('@newtonschool.co')) {
      payload = { email: newAdminEmail, globalRole: newAdminGlobalRole };
    } else if (newAdminEmail.endsWith('@adypu.edu.in')) {
      payload = { email: newAdminEmail, clubId: newAdminClubId, clubRole: 'CLUB_ADMIN' as const };
    } else {
      message.error('Unsupported domain');
      return;
    }

    provisionUser.mutate(payload, {
      onSuccess: () => {
        message.success('Platform user provisioned successfully');
        setAddUserModalOpen(false);
        setNewAdminEmail('');
        setNewAdminClubId(undefined);
      },
      onError: (err: unknown) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        message.error((err as any).response?.data?.error || 'Failed to provision user');
      }
    });
  };

  const handleAddStudentSubmit = () => {
    addStudent.mutate(newStudentEmail, {
      onSuccess: () => {
        message.success('Student added successfully');
        setAddStudentModalOpen(false);
        setNewStudentEmail('');
      },
      onError: (err: unknown) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        message.error((err as any).response?.data?.error || 'Failed to add student');
      }
    });
  };

  const handleImportSubmit = () => {
    if (!importFile) return;
    importStudents.mutate(importFile, {
      onSuccess: (res: unknown) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const response = res as any;
        setImportResult({
          added: response.added || 0,
          already_present: response.already_present || 0,
          errors: response.errors || []
        });
        setImportFile(null);
      },
      onError: (err: unknown) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        message.error((err as any).response?.data?.error || 'The uploaded file could not be processed.');
      }
    });
  };

  const handleRevokeStudent = (id: string) => {
    Modal.confirm({
      title: 'Remove from Student Directory?',
      icon: <ExclamationCircleOutlined className="text-red-500" />,
      content: 'This revokes this student\'s NST Events eligibility. Their account, academic history, Club memberships, registrations, and attendance are not deleted.',
      okText: 'Remove from Directory',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: () => {
        removeStudent.mutate(id, {
          onSuccess: () => message.success('Student access revoked'),
          onError: () => message.error('Failed to revoke access'),
        });
      }
    });
  };

  const handleRevokeSessions = (user: AdminUser) => {
    Modal.confirm({
      title: 'Force Logout User?',
      icon: <ExclamationCircleOutlined className="text-red-500" />,
      content: `This will immediately revoke all active refresh sessions for ${user.fullName || user.email}. They will be forced to log in again on all their devices.`,
      okText: 'Force Logout',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          await revokeSessions.mutateAsync(user.id);
          message.success('User sessions revoked successfully');
        } catch (err: unknown) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          message.error((err as any).response?.data?.error || 'Failed to revoke sessions');
        }
      }
    });
  };

  const adminColumns = [
    { title: 'Name', dataIndex: 'fullName', key: 'fullName', render: (text: string) => <span className="font-medium">{text ?? 'Not yet registered'}</span> },
    { title: 'Email', dataIndex: 'email', key: 'email', render: (text: string) => <span style={{ opacity: 0.65 }}>{text}</span> },
    {
      title: 'Administrative Role',
      key: 'role',
      render: (_: unknown, user: AdminUser) => {
        const isGlobalAdmin = ['PLATFORM_ADMIN', 'FACULTY_ADMIN', 'FACULTY_MENTOR'].includes(user.globalRole);
        const isClubAdmin = user.clubMemberships && user.clubMemberships.length > 0;
        
        let status: 'success' | 'warning' | 'error' | 'default' | 'processing' = 'default';
        let label: string = user.globalRole;
        const mapped = ROLE_OPTIONS.find(o => o.value === user.globalRole);
        if (mapped) label = mapped.label;

        if (user.globalRole === 'PLATFORM_ADMIN') status = 'error';
        if (user.globalRole === 'FACULTY_ADMIN') status = 'warning';
        if (user.globalRole === 'FACULTY_MENTOR') status = 'processing';
        
        if (!isGlobalAdmin && isClubAdmin) {
          label = 'Club Admin';
          status = 'processing';
        }
        
        let badgeContent = <span className="font-medium">{label}</span>;
        
        if (isClubAdmin) {
           const clubCount = user.clubMemberships!.length;
           
           const popoverContent = (
             <div>
               <div className="font-medium mb-1">
                 {isGlobalAdmin ? 'Also Club Admin of:' : (clubCount === 1 ? `Club Admin of ${user.clubMemberships![0].club.name}` : 'Administrator of:')}
               </div>
               {clubCount > 1 && (
                 <div className="text-sm">
                   {user.clubMemberships!.map(m => (
                     <div key={m.id}>• {m.club.name}</div>
                   ))}
                 </div>
               )}
             </div>
           );
           
           const ariaLabel = `${label}. Administrator of ${user.clubMemberships!.map(m => m.club.name).join(' and ')}`;
           
           badgeContent = (
             <Popover content={popoverContent} trigger={['hover', 'focus']} placement="topLeft">
               <span tabIndex={0} className="font-medium cursor-help" aria-label={ariaLabel}>
                 {label}
                 {!isGlobalAdmin && <span className="text-gray-500 font-normal ml-1">· {clubCount} {clubCount === 1 ? 'club' : 'clubs'}</span>}
               </span>
             </Popover>
           );
        }

        return <Badge status={status} text={badgeContent} />;
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: unknown, user: AdminUser) => {
        const items = [];
        
        if (canChangeGlobalRole(currentUser, user)) {
          const isSelf = currentUser?.id === user.id;
          items.push({ 
            key: 'role', 
            label: (
              <span className="flex items-center justify-between">
                Change Global Role 
                {isSelf && <Tooltip title="You cannot demote yourself."><InfoCircleOutlined className="text-gray-400 ml-2" /></Tooltip>}
              </span>
            ),
            disabled: isSelf,
            onClick: () => { 
              setRoleModalUser(user); 
              setSelectedRole(user.globalRole); 
              updateRole.reset(); 
            } 
          });
        }
        
        if (canViewTargetClub(currentUser, user)) {
          items.push({ 
            key: 'view_club', 
            label: user.clubMemberships!.length > 1 ? 'View Clubs' : 'View Club', 
            onClick: () => {
              if (user.clubMemberships && user.clubMemberships.length > 0) {
                router.push(`/clubs/${user.clubMemberships[0].club.id}`);
              }
            } 
          });
        } 
        
        if (canRevokeUserSessions(currentUser, user)) {
          items.push({
            type: 'divider' as const,
          });
          items.push({
            key: 'force_logout',
            label: <span className="text-red-500">Force Logout</span>,
            onClick: () => handleRevokeSessions(user),
          });
        }
        

        
        if (items.length === 0) return <span style={{ opacity: 0.45 }}>-</span>;
        return <Dropdown menu={{ items }} trigger={['click']}><Button size="small">Actions ▾</Button></Dropdown>;
      },
      align: 'right' as const,
    },
  ];

  const studentColumns = [
    { title: 'Student', key: 'student', render: (_: unknown, row: AuthorizedStudent) => (
      <div className="flex flex-col">
        <span className="font-medium">
          {row.user ? row.user.fullName : <span className="text-gray-400 font-normal italic">Not yet registered (Directory only)</span>}
        </span>
        <span className="text-sm" style={{ opacity: 0.65 }}>{row.normalizedEmail}</span>
      </div>
    )},
    { title: 'Program', key: 'program', render: (_: unknown, row: AuthorizedStudent) => row.user?.academicProfile ? <Tag color="blue">{row.user.academicProfile.batch?.program?.code}</Tag> : <span style={{ opacity: 0.45 }}>-</span> },
    { title: 'Batch', key: 'batch', render: (_: unknown, row: AuthorizedStudent) => row.user?.academicProfile ? <span>{row.user.academicProfile.batch?.admissionYear}-{row.user.academicProfile.batch?.graduationYear}</span> : <span style={{ opacity: 0.45 }}>-</span> },
    { title: 'Status', dataIndex: 'status', key: 'status', render: (status: string) => (
      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
        {status === 'ACTIVE' ? 'Active' : 'Revoked'}
      </span>
    )},
    {
      title: 'Actions',
      key: 'actions',
      render: (_: unknown, row: AuthorizedStudent) => {
        const canChangeBatch = row.user ? canChangeAcademicBatch(currentUser, row.user) : false;
        const canRemove = isPlatformAdmin;
        
        const items = [];
        
        if (row.user) {
          items.push({
            key: 'view_profile',
            label: 'View',
            disabled: true,
            onClick: () => {}
          });
        }
        
        if (canChangeBatch && row.user) {
          items.push({
            key: 'change_batch',
            label: 'Change Academic Batch',
            onClick: () => {
              setBatchModalUser({
                id: row.user!.id,
                email: row.normalizedEmail,
                fullName: row.user!.fullName,
                globalRole: row.user!.globalRole as AdminUser['globalRole'],
                clubMemberships: row.user!.clubMemberships as unknown as AdminUser['clubMemberships'],
              } as AdminUser);
              setSelectedBatchId(undefined);
            }
          });
        }
        
        if (canRemove) {
          if (items.length > 0) items.push({ type: 'divider' as const });
          items.push({
            key: 'remove',
            label: <span className="text-red-500">Remove</span>,
            onClick: () => handleRevokeStudent(row.id)
          });
        }
        
        if (items.length === 0) return <span style={{ opacity: 0.45 }}>-</span>;
        return <Dropdown menu={{ items }} trigger={['click']}><Button size="small">Actions ▾</Button></Dropdown>;
      },
      align: 'right' as const,
    }
  ];

  const tabItems = [
    {
      key: 'students',
      label: 'Students',
      children: (
        <div style={{ background: 'var(--ant-color-bg-container)', borderColor: 'var(--ant-color-border-secondary)' }} className="rounded-lg border overflow-hidden shadow-sm">
          <div style={{ background: 'var(--ant-color-bg-layout)', borderColor: 'var(--ant-color-border-secondary)' }} className="p-4 border-b flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-lg font-semibold m-0">Students</h2>
              <p className="text-sm m-0" style={{ opacity: 0.65 }}>Manage NST student eligibility and academic identity.</p>
            </div>
            <div className="flex flex-wrap gap-2">
            {isPlatformAdmin && (
              <>
                <Button type="primary" onClick={() => setAddStudentModalOpen(true)}>Add Student</Button>
                <Button icon={<UploadOutlined />} onClick={() => setImportModalOpen(true)}>Import CSV</Button>
              </>
            )}
            </div>
          </div>
          
          <div style={{ borderColor: 'var(--ant-color-border-secondary)' }} className="p-4 border-b flex gap-4">
            <Input 
              placeholder="Search students..." 
              prefix={<SearchOutlined style={{ opacity: 0.45 }} />} 
              value={searchQuery} 
              onChange={(e) => setParam('q', e.target.value)} 
              className="max-w-xs" 
              allowClear 
            />
            <Select
              placeholder="Status"
              allowClear
              value={statusFilter}
              onChange={(val) => setParam('status', val)}
              style={{ width: 150 }}
              options={[{ label: 'Active', value: 'ACTIVE' }, { label: 'Revoked', value: 'REVOKED' }]}
            />
          </div>

          {isStudentsLoading ? (
            <div className="p-6"><Skeleton active paragraph={{ rows: 6 }} /></div>
          ) : studentsError ? (
            <div className="p-12 text-center" style={{ opacity: 0.65 }}>Unable to load Students.</div>
          ) : students.length === 0 ? (
            <div className="p-16 text-center" style={{ opacity: 0.65 }}>
              <div className="text-lg mb-2">No students match your current filters.</div>
              {(!searchQuery && !statusFilter) && <div className="text-sm">No students are currently in the NST Student Directory.</div>}
            </div>
          ) : (
            <Table 
              dataSource={students} 
              columns={isPlatformAdmin || students.some(row => row.user) ? studentColumns : studentColumns.filter(c => c.key !== 'actions')} 
              rowKey="id" 
              pagination={{ pageSize: 50 }} 
              scroll={{ x: 800 }} 
              className="border-t-0"
              size="middle"
            />
          )}
        </div>
      )
    },
    {
      key: 'admin-roles',
      label: 'Admin Roles',
      children: (
        <div style={{ background: 'var(--ant-color-bg-container)', borderColor: 'var(--ant-color-border-secondary)' }} className="rounded-lg border overflow-hidden shadow-sm">
          <div style={{ background: 'var(--ant-color-bg-layout)', borderColor: 'var(--ant-color-border-secondary)' }} className="p-4 border-b flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-lg font-semibold m-0">Admin Roles</h2>
              <p className="text-sm m-0" style={{ opacity: 0.65 }}>Manage platform-wide authorization.</p>
            </div>
              {isPlatformAdmin && (
                <Button type="primary" onClick={() => setAddUserModalOpen(true)}>Add User</Button>
              )}
          </div>
          <div style={{ borderColor: 'var(--ant-color-border-secondary)' }} className="p-4 border-b flex gap-4">
            <Input 
              placeholder="Search users..." 
              prefix={<SearchOutlined style={{ opacity: 0.45 }} />} 
              value={searchQuery} 
              onChange={(e) => setParam('q', e.target.value)} 
              className="max-w-xs" 
              allowClear 
            />
            <Select
              placeholder="Filter by Role"
              value={roleFilter}
              onChange={(val) => setParam('role', val)}
              style={{ width: 180 }}
              options={[
                { label: 'All Roles', value: 'ALL' },
                { label: 'Platform Admin', value: 'PLATFORM_ADMIN' },
                { label: 'Faculty Admin', value: 'FACULTY_ADMIN' },
                { label: 'Faculty Mentor', value: 'FACULTY_MENTOR' },
                { label: 'Club Admin', value: 'CLUB_ADMIN' }
              ]}
            />
          </div>

          <div className="px-4 py-2 text-xs text-gray-500 flex justify-end items-center gap-2">
            Active Platform Admins: {platformAdminCount}
          </div>

          {isUsersLoading ? (
            <div className="p-6"><Skeleton active paragraph={{ rows: 6 }} /></div>
          ) : usersError ? (
            <div className="p-12 text-center" style={{ opacity: 0.65 }}>Unable to load Admin Roles.</div>
          ) : users.length === 0 ? (
            <div className="p-16 text-center" style={{ opacity: 0.65 }}>No users match your current filters.</div>
          ) : (
            <>
              <Table 
                dataSource={users} 
                columns={adminColumns} 
                rowKey="id" 
                pagination={false} 
                scroll={{ x: 800 }} 
                size="middle"
              />
              {hasNextPage && (
                <div style={{ borderColor: 'var(--ant-color-border-secondary)', background: 'var(--ant-color-bg-layout)' }} className="text-center py-6 border-t">
                  <Button onClick={() => fetchNextPage()} loading={isFetchingNextPage}>Load More Users</Button>
                </div>
              )}
            </>
          )}
        </div>
      )
    }
  ];

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6">
      <AdminPageHeader
        breadcrumbs={[{ title: 'Administration' }, { title: 'Users & Roles' }]}
        title="Users & Roles"
        description="Manage NST student eligibility and platform-wide administrative roles."
      />

      <Tabs 
        activeKey={activeTab} 
        onChange={(key) => setParam('tab', key)} 
        items={tabItems} 
        className="mt-6"
        destroyOnHidden
      />

      {/* Role Change Modal */}
      <Modal 
        title="Change Global Role" 
        open={!!roleModalUser} 
        onOk={handleRoleChangeSubmit} 
        onCancel={() => setRoleModalUser(null)} 
        confirmLoading={updateRole.isPending} 
        okButtonProps={{ disabled: selectedRole === roleModalUser?.globalRole }}
        width={500}
      >
        <div className="mb-4 text-gray-600">
          Select a new global role for <strong className="text-gray-900">{roleModalUser?.fullName ?? roleModalUser?.email}</strong>.
          <br/>
          <span className="text-sm text-gray-500 mt-2 block">This changes their platform-wide permissions. It does not affect Club memberships or Club roles.</span>
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-gray-700">New Role</label>
          <Select 
            style={{ width: '100%' }} 
            value={selectedRole} 
            onChange={setSelectedRole} 
            options={ROLE_OPTIONS} 
            size="large"
          />
        </div>
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
        <Select 
          showSearch 
          style={{ width: '100%' }} 
          placeholder="Select an academic batch" 
          value={selectedBatchId} 
          onChange={setSelectedBatchId} 
          loading={isBatchesLoading} 
          filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())} 
          options={(batchesData || []).map(b => ({ label: b.display_name, value: b.id }))} 
          size="large"
        />
      </Modal>

      {/* Add User Modal */}
      <Modal 
        title="Add Platform User" 
        open={addUserModalOpen} 
        onOk={handleAddUserSubmit} 
        onCancel={() => setAddUserModalOpen(false)} 
        confirmLoading={provisionUser.isPending}
        okButtonProps={{ 
          disabled: !newAdminEmail || !(
            (newAdminEmail.endsWith('@newtonschool.co') && ['FACULTY_MENTOR', 'FACULTY_ADMIN', 'PLATFORM_ADMIN'].includes(newAdminGlobalRole)) ||
            (newAdminEmail.endsWith('@adypu.edu.in') && newAdminClubId)
          )
        }}
        okText="Add User"
      >
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <Input 
            placeholder="faculty@newtonschool.co or student@adypu.edu.in" 
            value={newAdminEmail} 
            onChange={e => {
              setNewAdminEmail(e.target.value.toLowerCase().trim());
              setNewAdminClubId(undefined); // Reset on email change
            }} 
            size="large"
          />
        </div>

        {newAdminEmail.endsWith('@newtonschool.co') && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Global Role</label>
            <Select 
              style={{ width: '100%' }} 
              value={newAdminGlobalRole} 
              onChange={setNewAdminGlobalRole} 
              options={[
                { value: 'FACULTY_MENTOR', label: 'Faculty Mentor' },
                { value: 'FACULTY_ADMIN', label: 'Faculty Admin' },
                { value: 'PLATFORM_ADMIN', label: 'Platform Admin' }
              ]} 
              size="large"
            />
          </div>
        )}

        {newAdminEmail.endsWith('@adypu.edu.in') && (
          <>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Administrative Role</label>
              <Select 
                style={{ width: '100%' }} 
                value="CLUB_ADMIN" 
                disabled
                options={[{ value: 'CLUB_ADMIN', label: 'Club Admin' }]} 
                size="large"
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Club</label>
              <Select 
                showSearch
                style={{ width: '100%' }} 
                placeholder="Select Club"
                value={newAdminClubId} 
                onChange={setNewAdminClubId} 
                loading={isClubsLoading}
                filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())} 
                options={(clubsData?.data || []).map(c => ({ value: c.id, label: c.name }))}
                size="large"
              />
            </div>
          </>
        )}

        {newAdminEmail.length > 0 && newAdminEmail.includes('@') && !newAdminEmail.endsWith('@newtonschool.co') && !newAdminEmail.endsWith('@adypu.edu.in') && (
          <div className="text-red-500 text-sm mt-2">
            Unsupported domain. Only @newtonschool.co and @adypu.edu.in are supported.
          </div>
        )}
      </Modal>

      {/* Add Student Modal */}
      <Modal 
        title="Add Student" 
        open={addStudentModalOpen} 
        onOk={handleAddStudentSubmit} 
        onCancel={() => setAddStudentModalOpen(false)} 
        confirmLoading={addStudent.isPending}
        okButtonProps={{ disabled: !newStudentEmail || !newStudentEmail.endsWith('@adypu.edu.in') }}
      >
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Student Email</label>
          <Input 
            placeholder="student@adypu.edu.in" 
            value={newStudentEmail} 
            onChange={e => setNewStudentEmail(e.target.value)} 
            size="large"
          />
          <p className="mt-2 text-sm text-gray-500">Only @adypu.edu.in student accounts can be added to the NST Student Directory.</p>
        </div>
      </Modal>

      {/* Import CSV Modal */}
      <Modal 
        title="Import Students" 
        open={importModalOpen} 
        onOk={handleImportSubmit} 
        onCancel={() => { 
          setImportModalOpen(false); 
          setImportFile(null); 
          setImportResult(null);
        }} 
        confirmLoading={importStudents.isPending} 
        okButtonProps={{ disabled: !importFile && !importResult, className: importResult ? 'hidden' : '' }}
        cancelText={importResult ? 'Close' : 'Cancel'}
      >
        {!importResult ? (
          <div className="flex flex-col gap-4 py-4">
            <Upload.Dragger 
              beforeUpload={file => { setImportFile(file); return false; }} 
              maxCount={1} 
              accept=".csv"
              fileList={importFile ? [importFile as unknown as import('antd/es/upload/interface').UploadFile] : []}
              onRemove={() => setImportFile(null)}
            >
              <p className="ant-upload-drag-icon"><UploadOutlined /></p>
              <p className="ant-upload-text">Click or drag CSV file to this area to upload</p>
              <p className="ant-upload-hint">Upload a CSV containing one student email per row. (Max 2MB)</p>
            </Upload.Dragger>
          </div>
        ) : (
          <div className="py-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Import Complete</h3>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-green-50 p-4 rounded-lg border border-green-100">
                <div className="text-green-800 text-sm font-medium">Added</div>
                <div className="text-2xl font-bold text-green-700">{importResult.added}</div>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <div className="text-gray-600 text-sm font-medium">Already Present</div>
                <div className="text-2xl font-bold text-gray-700">{importResult.already_present}</div>
              </div>
            </div>
            
            {importResult.errors && importResult.errors.length > 0 && (
              <div className="mt-4">
                <div className="text-sm font-medium text-red-800 mb-2">Rejected Rows ({importResult.errors.length})</div>
                <div className="bg-red-50 border border-red-100 rounded-md p-3 max-h-40 overflow-y-auto">
                  <ul className="text-sm text-red-700 space-y-1 list-disc pl-4 m-0">
                    {importResult.errors.map((err, i) => <li key={i}>{err}</li>)}
                  </ul>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
