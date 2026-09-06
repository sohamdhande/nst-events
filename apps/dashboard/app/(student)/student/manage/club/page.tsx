'use client';

import React, { useState, useEffect } from 'react';
import { useClubAdmin } from '../../../../../components/layout/ClubAdminProvider';
import { useClubDetail, useAddClubMember, useUpdateClubMemberRole, useRemoveClubMember, ClubRole, ClubMember } from '../../../../../hooks/useClubDetail';
import { useUpdateClub } from '../../../../../hooks/useUpdateClub';
import { useCurrentUser } from '../../../../../hooks/useCurrentUser';
import { Users, Calendar, Settings, Image as ImageIcon, Plus, ShieldAlert } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Modal } from '../../../../../components/ui/Modal';

// --- Modals ---

function AddMemberModal({ clubId, isOpen, onClose }: { clubId: string, isOpen: boolean, onClose: () => void }) {
  const [userId, setUserId] = useState('');
  const [role, setRole] = useState<ClubRole>('MEMBER');
  const [error, setError] = useState('');
  const addMemberMutation = useAddClubMember(clubId);

  // Expose ONLY intentional roles
  const assignableRoles: { label: string, value: ClubRole }[] = [
    { label: 'Member', value: 'MEMBER' },
    { label: 'Core Member', value: 'CORE_MEMBER' },
    { label: 'Club Admin', value: 'CLUB_ADMIN' }
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await addMemberMutation.mutateAsync({ user_id: userId, role });
      setUserId('');
      setRole('MEMBER');
      onClose();
    } catch (err: any) {
      setError(err?.data?.error || err.message || 'Failed to add member');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="ADD MEMBER">
      <div className="p-6">
        <div className="mb-6 p-4 bg-stitch-surface-variant border border-stitch-outline-variant flex gap-3">
          <ShieldAlert className="w-5 h-5 text-stitch-secondary shrink-0" />
          <p className="text-sm font-sans text-stitch-on-surface-variant leading-relaxed">
            Name and email lookup is not available to Club Administrators in V1. Enter the platform user ID provided by the user.
          </p>
        </div>
        
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30">
            <p className="text-sm font-mono text-red-500 uppercase tracking-widest">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-[10px] font-mono font-bold text-stitch-secondary uppercase tracking-widest mb-2">
              Platform User ID
            </label>
            <input 
              type="text" 
              required
              value={userId}
              onChange={e => setUserId(e.target.value)}
              placeholder="e.g. 123e4567-e89b-12d3-a456-426614174000"
              className="w-full bg-stitch-surface border border-stitch-outline-variant px-4 py-3 text-sm font-mono text-stitch-on-surface focus:border-stitch-primary focus:outline-none transition-colors"
            />
          </div>
          <div>
            <label className="block text-[10px] font-mono font-bold text-stitch-secondary uppercase tracking-widest mb-2">
              Club Role
            </label>
            <select
              value={role}
              onChange={e => setRole(e.target.value as ClubRole)}
              className="w-full bg-stitch-surface border border-stitch-outline-variant px-4 py-3 text-sm font-mono text-stitch-on-surface focus:border-stitch-primary focus:outline-none transition-colors appearance-none"
            >
              {assignableRoles.map(r => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
          
          <div className="pt-4 flex justify-end gap-3">
            <button 
              type="button"
              onClick={onClose}
              className="px-6 py-3 border border-stitch-on-surface text-stitch-on-surface font-mono font-bold text-xs tracking-widest hover:bg-stitch-surface transition-colors uppercase disabled:opacity-50"
            >
              Cancel
            </button>
            <button 
              type="submit"
              disabled={addMemberMutation.isPending}
              className="px-6 py-3 bg-stitch-primary text-stitch-on-primary font-mono font-bold text-xs tracking-widest hover:opacity-80 transition-colors uppercase disabled:opacity-50 min-w-[140px]"
            >
              {addMemberMutation.isPending ? 'Adding...' : 'Add Member'}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
}

function ChangeRoleModal({ clubId, member, isOpen, onClose }: { clubId: string, member: ClubMember | null, isOpen: boolean, onClose: () => void }) {
  const [role, setRole] = useState<ClubRole>('MEMBER');
  const [error, setError] = useState('');
  
  // Safe default hook usage
  const updateRoleMutation = useUpdateClubMemberRole(clubId, member?.user_id || 'unselected');

  useEffect(() => {
    if (member) setRole(member.role);
  }, [member]);

  // Expose ONLY intentional roles
  const assignableRoles: { label: string, value: ClubRole }[] = [
    { label: 'Member', value: 'MEMBER' },
    { label: 'Core Member', value: 'CORE_MEMBER' },
    { label: 'Club Admin', value: 'CLUB_ADMIN' }
  ];

  if (!member) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (role === member.role) return onClose();
    try {
      await updateRoleMutation.mutateAsync({ role });
      onClose();
    } catch (err: any) {
      setError(err?.data?.error || err.message || 'Failed to update role');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="CHANGE ROLE">
      <div className="p-6">
        <div className="mb-6">
          <p className="text-sm font-sans text-stitch-on-surface-variant leading-relaxed">
            Update role for <span className="font-bold text-stitch-on-surface">{member.full_name}</span>.
          </p>
        </div>
        
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30">
            <p className="text-sm font-mono text-red-500 uppercase tracking-widest">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-[10px] font-mono font-bold text-stitch-secondary uppercase tracking-widest mb-2">
              New Club Role
            </label>
            <select
              value={role}
              onChange={e => setRole(e.target.value as ClubRole)}
              className="w-full bg-stitch-surface border border-stitch-outline-variant px-4 py-3 text-sm font-mono text-stitch-on-surface focus:border-stitch-primary focus:outline-none transition-colors appearance-none"
            >
              {assignableRoles.map(r => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
          
          <div className="pt-4 flex justify-end gap-3">
            <button 
              type="button"
              onClick={onClose}
              className="px-6 py-3 border border-stitch-on-surface text-stitch-on-surface font-mono font-bold text-xs tracking-widest hover:bg-stitch-surface transition-colors uppercase disabled:opacity-50"
            >
              Cancel
            </button>
            <button 
              type="submit"
              disabled={updateRoleMutation.isPending}
              className="px-6 py-3 bg-stitch-primary text-stitch-on-primary font-mono font-bold text-xs tracking-widest hover:opacity-80 transition-colors uppercase disabled:opacity-50 min-w-[140px]"
            >
              {updateRoleMutation.isPending ? 'Updating...' : 'Save Role'}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
}


export default function ClubManagePage() {
  const { activeClubId, isHydrated } = useClubAdmin();
  const router = useRouter();

  // Redirect if no club selected
  useEffect(() => {
    if (isHydrated && !activeClubId) {
      router.push('/student/home');
    }
  }, [isHydrated, activeClubId, router]);

  const { data: club, isLoading } = useClubDetail(activeClubId || '');
  const updateClub = useUpdateClub();
  const { data: currentUser } = useCurrentUser();
  const removeMemberMutation = useRemoveClubMember(activeClubId || '');

  const [isEditing, setIsEditing] = useState(false);
  const [description, setDescription] = useState('');
  const [bannerUrl, setBannerUrl] = useState('');

  const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);
  const [selectedMemberRole, setSelectedMemberRole] = useState<ClubMember | null>(null);
  const [selectedMemberRemove, setSelectedMemberRemove] = useState<ClubMember | null>(null);
  const [removeError, setRemoveError] = useState('');
  
  // Security check: Only show roster if the current user is a CLUB_ADMIN for this club
  const isCurrentUserClubAdmin = React.useMemo(() => {
    if (!club || !currentUser) return false;
    const membership = club.members.find(m => m.user_id === currentUser.id);
    return membership?.role === 'CLUB_ADMIN';
  }, [club, currentUser]);

  const handleRemoveConfirm = async () => {
    if (!selectedMemberRemove || !activeClubId) return;
    setRemoveError('');
    try {
      await removeMemberMutation.mutateAsync(selectedMemberRemove.user_id);
      setSelectedMemberRemove(null);
    } catch (err: any) {
      setRemoveError(err?.data?.error || err.message || 'Failed to remove member');
    }
  };

  useEffect(() => {
    if (club) {
      setDescription(club.description || '');
      setBannerUrl(club.banner_url || '');
    }
  }, [club]);

  if (!isHydrated || isLoading) {
    return (
      <div className="w-full flex-grow flex justify-center items-center h-64">
        <div className="animate-pulse flex flex-col items-center">
          <div className="h-8 w-8 border-4 border-stitch-on-surface border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-sm font-medium text-stitch-secondary uppercase tracking-widest font-mono">Loading Club...</p>
        </div>
      </div>
    );
  }

  if (!club) return null;

  const handleSave = () => {
    if (!activeClubId) return;
    updateClub.mutate({
      id: activeClubId,
      payload: { description, banner_url: bannerUrl }
    }, {
      onSuccess: () => setIsEditing(false)
    });
  };

  return (
    <div className="w-full max-w-[1440px] mx-auto px-6 py-6 md:px-12 md:py-8 lg:px-16">
      <div className="mb-8">
        <div className="text-[11px] font-mono font-bold tracking-widest uppercase mb-1 text-stitch-secondary">
          CLUB HUB
        </div>
        <h1 className="text-3xl md:text-4xl lg:text-[44px] font-black text-stitch-on-surface tracking-tight leading-tight mb-2 uppercase" style={{ fontFamily: 'Syne, sans-serif' }}>
          {club.name}
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Col: Edit Profile */}
        <div className="lg:col-span-8 space-y-8">
          <div className="p-6 border border-stitch-outline-variant bg-stitch-surface-container-lowest">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xs font-mono font-bold tracking-[0.2em] text-stitch-on-surface uppercase flex items-center gap-2">
                <Settings className="w-4 h-4" />
                Club Profile
              </h2>
              {!isEditing ? (
                <button 
                  onClick={() => setIsEditing(true)}
                  className="text-[10px] font-mono font-bold uppercase tracking-widest text-stitch-primary hover:underline"
                >
                  Edit Profile
                </button>
              ) : null}
            </div>

            {isEditing ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-mono font-bold text-stitch-secondary uppercase tracking-widest mb-1.5">Banner Image URL</label>
                  <div className="flex gap-2 items-center">
                    <ImageIcon className="w-4 h-4 text-stitch-secondary flex-shrink-0" />
                    <input 
                      type="url"
                      value={bannerUrl}
                      onChange={(e) => setBannerUrl(e.target.value)}
                      className="w-full bg-stitch-surface border border-stitch-outline-variant px-3 py-2 text-sm font-mono text-stitch-on-surface focus:border-stitch-primary focus:outline-none transition-colors"
                      placeholder="https://example.com/banner.jpg"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-mono font-bold text-stitch-secondary uppercase tracking-widest mb-1.5">Description</label>
                  <textarea 
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={6}
                    className="w-full bg-stitch-surface border border-stitch-outline-variant px-3 py-2 text-sm font-sans text-stitch-on-surface focus:border-stitch-primary focus:outline-none transition-colors leading-relaxed"
                    placeholder="Tell everyone what this club is about..."
                  />
                </div>

                <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-stitch-outline-variant">
                  <button 
                    onClick={() => {
                      setIsEditing(false);
                      setDescription(club.description || '');
                      setBannerUrl(club.banner_url || '');
                    }}
                    className="px-4 py-2 border border-stitch-on-surface text-stitch-on-surface font-mono font-bold text-[10px] tracking-widest hover:bg-stitch-surface transition-colors uppercase disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleSave}
                    disabled={updateClub.isPending}
                    className="px-4 py-2 bg-stitch-primary text-stitch-on-primary font-mono font-bold text-[10px] tracking-widest hover:opacity-80 transition-colors uppercase disabled:opacity-50 flex items-center justify-center min-w-[120px]"
                  >
                    {updateClub.isPending ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {club.banner_url ? (
                  <div className="w-full h-48 border border-stitch-outline-variant overflow-hidden bg-stitch-surface-variant flex items-center justify-center relative group">
                    <img src={club.banner_url} alt="Club Banner" className="w-full h-full object-cover" />
                  </div>
                ) : (
                   <div className="w-full h-32 border border-stitch-outline-variant bg-stitch-surface-variant flex flex-col items-center justify-center text-stitch-secondary">
                     <ImageIcon className="w-8 h-8 mb-2 opacity-50" />
                     <span className="text-xs font-mono uppercase tracking-widest">No Banner Image</span>
                   </div>
                )}
                
                <div>
                  <h3 className="text-[10px] font-mono font-bold text-stitch-secondary uppercase tracking-widest mb-2">Description</h3>
                  {club.description ? (
                    <div className="prose prose-sm prose-gray max-w-none text-stitch-on-surface-variant leading-relaxed font-sans break-words whitespace-pre-wrap">
                      {club.description}
                    </div>
                  ) : (
                    <p className="text-sm text-stitch-secondary italic">No description set.</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Roster Block */}
          {isCurrentUserClubAdmin && (
            <div className="p-6 border border-stitch-outline-variant bg-stitch-surface-container-lowest">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xs font-mono font-bold tracking-[0.2em] text-stitch-on-surface uppercase flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Club Roster
                </h2>
                <button 
                  onClick={() => setIsAddMemberModalOpen(true)}
                  className="text-[10px] font-mono font-bold uppercase tracking-widest text-stitch-primary hover:underline flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> Add Member
                </button>
              </div>

              {club.members.length === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center border border-stitch-outline-variant bg-stitch-surface-variant/30 text-stitch-secondary">
                  <p className="text-sm font-mono tracking-widest uppercase">No members found</p>
                </div>
              ) : (
                <div className="border border-stitch-outline-variant bg-stitch-surface overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[500px]">
                    <thead>
                      <tr className="border-b border-stitch-outline-variant bg-stitch-surface-variant">
                        <th className="px-4 py-3 text-[10px] font-mono font-bold text-stitch-secondary uppercase tracking-[0.2em]">Member</th>
                        <th className="px-4 py-3 text-[10px] font-mono font-bold text-stitch-secondary uppercase tracking-[0.2em]">Role</th>
                        <th className="px-4 py-3 text-[10px] font-mono font-bold text-stitch-secondary uppercase tracking-[0.2em] text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stitch-outline-variant">
                      {club.members.map((member) => {
                        const isSelf = member.user_id === currentUser?.id;
                        // Hierarchy: CLUB_ADMIN cannot manage other CLUB_ADMINs or FACULTY_MENTORs, and cannot manage themselves via this UI.
                        const canManage = !isSelf && member.role !== 'CLUB_ADMIN' && member.role !== 'FACULTY_MENTOR';
                        
                        return (
                        <tr key={member.user_id} className="hover:bg-stitch-surface-variant/50 transition-colors">
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-3">
                              {member.avatar_url ? (
                                <img src={member.avatar_url} alt="avatar" className="w-8 h-8 object-cover border border-stitch-outline-variant" />
                              ) : (
                                <div className="w-8 h-8 border border-stitch-outline-variant bg-stitch-surface-container-highest flex items-center justify-center shrink-0">
                                  <span className="text-[10px] font-mono font-bold text-stitch-on-surface uppercase">
                                    {member.full_name.substring(0, 2)}
                                  </span>
                                </div>
                              )}
                              <span className="text-sm font-bold text-stitch-on-surface font-sans">
                                {member.full_name} {isSelf && <span className="text-stitch-secondary ml-1 font-normal">(You)</span>}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <span className="inline-block px-2 py-1 text-[10px] font-mono font-bold tracking-widest uppercase border border-stitch-outline-variant bg-stitch-surface-variant text-stitch-on-surface-variant">
                              {member.role.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-right">
                            <div className="flex items-center justify-end gap-3 min-h-[24px]">
                              {canManage ? (
                                <>
                                  <button 
                                    onClick={() => setSelectedMemberRole(member)}
                                    className="text-[10px] font-mono font-bold text-stitch-primary hover:underline uppercase tracking-widest"
                                  >
                                    Edit Role
                                  </button>
                                  <button 
                                    onClick={() => setSelectedMemberRemove(member)}
                                    className="text-[10px] font-mono font-bold text-red-500 hover:underline uppercase tracking-widest"
                                  >
                                    Remove
                                  </button>
                                </>
                              ) : (
                                <span className="text-[10px] font-mono font-bold text-stitch-secondary/50 uppercase tracking-widest">
                                  —
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      )})}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Col: Quick Links & Stats */}
        <div className="lg:col-span-4 space-y-6">
          <div className="p-5 border border-stitch-outline-variant bg-stitch-surface-container-lowest flex flex-col gap-4">
            <h3 className="text-xs font-mono font-bold tracking-[0.2em] text-stitch-on-surface uppercase border-b border-stitch-outline-variant pb-1.5">Overview</h3>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-stitch-secondary">
                <Users className="w-4 h-4" />
                <span className="text-xs font-mono uppercase tracking-widest">Members</span>
              </div>
              <span className="font-bold text-lg">{club.members.length}</span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-stitch-secondary">
                <Calendar className="w-4 h-4" />
                <span className="text-xs font-mono uppercase tracking-widest">Events</span>
              </div>
              <span className="font-bold text-lg">{club.event_count}</span>
            </div>
            
          </div>
        </div>
      </div>

      <AddMemberModal 
        clubId={activeClubId || ''} 
        isOpen={isAddMemberModalOpen} 
        onClose={() => setIsAddMemberModalOpen(false)} 
      />
      
      <ChangeRoleModal 
        clubId={activeClubId || ''}
        member={selectedMemberRole}
        isOpen={!!selectedMemberRole}
        onClose={() => setSelectedMemberRole(null)}
      />

      <Modal isOpen={!!selectedMemberRemove} onClose={() => !removeMemberMutation.isPending && setSelectedMemberRemove(null)} title="REMOVE MEMBER">
        <div className="p-6">
          <p className="text-sm font-sans text-stitch-on-surface-variant mb-6 leading-relaxed">
            Are you sure you want to remove <span className="font-bold text-stitch-on-surface">{selectedMemberRemove?.full_name}</span> from {club.name}?
          </p>
          
          {removeError && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30">
              <p className="text-sm font-mono text-red-500 uppercase tracking-widest">{removeError}</p>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-stitch-outline-variant">
            <button 
              onClick={() => setSelectedMemberRemove(null)}
              disabled={removeMemberMutation.isPending}
              className="px-6 py-3 border border-stitch-on-surface text-stitch-on-surface font-mono font-bold text-xs tracking-widest hover:bg-stitch-surface transition-colors uppercase disabled:opacity-50"
            >
              Cancel
            </button>
            <button 
              onClick={handleRemoveConfirm}
              disabled={removeMemberMutation.isPending}
              className="px-6 py-3 bg-red-500 text-white font-mono font-bold text-xs tracking-widest hover:opacity-80 transition-colors uppercase disabled:opacity-50 min-w-[140px]"
            >
              {removeMemberMutation.isPending ? 'Removing...' : 'Remove Member'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
