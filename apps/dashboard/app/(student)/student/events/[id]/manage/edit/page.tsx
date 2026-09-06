'use client';

import React, { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save, Send } from 'lucide-react';
import Link from 'next/link';
import { useEventDetail } from '../../../../../../../hooks/useEventDetail';
import { useUpdateEvent } from '../../../../../../../hooks/useUpdateEvent';
import { useEventLifecycle } from '../../../../../../../hooks/useEventLifecycle';
import { useClubAdmin } from '../../../../../../../components/layout/ClubAdminProvider';
import { useCurrentUser } from '../../../../../../../hooks/useCurrentUser';
import { useAcademicBatches } from '../../../../../../../hooks/useAcademicBatches';
import { useClubs } from '../../../../../../../hooks/useClubs';
import { MultiSelect } from '../../../../../components/MultiSelect';

export default function ManageEventEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: eventId } = use(params);
  const router = useRouter();
  const { activeClubId, isHydrated } = useClubAdmin();
  const { data: event, isLoading: isLoadingEvent } = useEventDetail(eventId);
  const updateEvent = useUpdateEvent(eventId);
  const { submitMutation } = useEventLifecycle();

  const { data: currentUser } = useCurrentUser();
  const { data: batchesData } = useAcademicBatches();
  const { data: clubsData } = useClubs();

  const isGlobalAdmin = currentUser?.global_role === 'PLATFORM_ADMIN' || currentUser?.global_role === 'FACULTY_ADMIN';

  const eligibleClubs = clubsData?.data?.map(c => ({ id: c.id, name: c.name })) || [];

  const collaboratingClubsOptions = eligibleClubs.filter(c => c.id !== activeClubId);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    startDate: '',
    startTime: '',
    endDate: '',
    endTime: '',
    location_name: '',
    event_type: 'WORKSHOP',
    visibility: 'PUBLIC',
    registration_type: 'INDIVIDUAL',
    attendance_type: 'SINGLE',
    max_capacity: '',
    minimum_team_size: '',
    maximum_team_size: '',
    audience: 'ALL_STUDENTS',
    audience_batch_ids: [] as string[],
    collaborating_club_ids: [] as string[]
  });

  useEffect(() => {
    if (event) {
      const metadata = event.metadata as any || {};
      const collabs = (event.eventClubs || [])
        .filter(ec => !ec.isPrimary)
        .map(ec => ec.clubId);

      setFormData({
        title: event.title || '',
        description: event.description || '',
        startDate: event.startTime ? new Date(event.startTime).toISOString().split('T')[0] : '',
        startTime: event.startTime ? new Date(event.startTime).toISOString().split('T')[1].slice(0, 5) : '',
        endDate: event.endTime ? new Date(event.endTime).toISOString().split('T')[0] : '',
        endTime: event.endTime ? new Date(event.endTime).toISOString().split('T')[1].slice(0, 5) : '',
        location_name: event.locationName || '',
        event_type: event.eventType || 'WORKSHOP',
        visibility: event.visibility || 'PUBLIC',
        registration_type: event.registrationType || 'INDIVIDUAL',
        attendance_type: event.attendanceType || 'SINGLE',
        max_capacity: event.maxCapacity ? event.maxCapacity.toString() : '',
        minimum_team_size: metadata.minimum_team_size ? metadata.minimum_team_size.toString() : '',
        maximum_team_size: metadata.maximum_team_size ? metadata.maximum_team_size.toString() : '',
        audience: event.audience || 'ALL_STUDENTS',
        audience_batch_ids: event.audienceBatchIds || [],
        collaborating_club_ids: collabs
      });
    }
  }, [event]);

  if (!isHydrated || isLoadingEvent) {
    return (
      <div className="w-full h-32 flex items-center justify-center border border-stitch-outline-variant bg-stitch-surface">
        <div className="animate-pulse flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-stitch-on-surface border-t-transparent rounded-full animate-spin"></div>
          <span className="text-[10px] font-mono uppercase tracking-widest text-stitch-secondary">Loading Event...</span>
        </div>
      </div>
    );
  }

  if (!event) return null;

  if (event.state !== 'DRAFT') {
    return (
      <div className="p-8 border border-red-600 bg-red-50 dark:bg-red-900/10 text-center space-y-4">
        <h3 className="text-sm font-mono font-bold text-red-800 dark:text-red-500 uppercase tracking-widest">Locked</h3>
        <p className="text-sm text-red-700 dark:text-red-600 font-mono max-w-[400px] mx-auto">
          This event is no longer a draft and cannot be edited. It is currently in {event.state} state.
        </p>
        <Link 
          href={`/student/events/${eventId}/manage`}
          className="inline-block px-6 py-3 border border-red-600 text-red-600 font-mono font-bold text-xs tracking-widest uppercase hover:bg-red-600 hover:text-white transition-colors"
        >
          Return to Overview
        </Link>
      </div>
    );
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleMultiSelectChange = (name: string, values: string[]) => {
    setFormData(prev => ({ ...prev, [name]: values }));
  };

  const handleSaveDraft = (e: React.FormEvent) => {
    e.preventDefault();
    
    const start_time = new Date(`${formData.startDate}T${formData.startTime}`).toISOString();
    const end_time = new Date(`${formData.endDate}T${formData.endTime}`).toISOString();

    updateEvent.mutate({
      title: formData.title,
      description: formData.description,
      start_time,
      end_time,
      location_name: formData.location_name,
      event_type: formData.event_type,
      visibility: formData.visibility as any,
      registration_type: formData.registration_type as any,
      attendance_type: formData.attendance_type as any,
      max_capacity: formData.max_capacity ? parseInt(formData.max_capacity) : null,
      audience: formData.audience as any,
      audience_batch_ids: formData.audience === 'SPECIFIC_BATCHES' ? formData.audience_batch_ids : undefined,
      metadata: formData.registration_type === 'TEAM' ? {
        minimum_team_size: formData.minimum_team_size ? parseInt(formData.minimum_team_size) : undefined,
        maximum_team_size: formData.maximum_team_size ? parseInt(formData.maximum_team_size) : undefined,
      } : undefined,
    }, {
      onSuccess: () => {
        alert('Draft saved successfully!');
      }
    });
  };

  const handleSubmitForApproval = () => {
    if (confirm('Are you sure you want to submit this event for approval? You will no longer be able to edit it.')) {
      submitMutation.mutate(eventId, {
        onSuccess: () => {
          router.push(`/student/events/${eventId}/manage`);
        }
      });
    }
  };

  return (
    <div className="space-y-6">
      
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-6 border border-yellow-600 bg-yellow-50 dark:bg-yellow-900/10">
        <div>
          <h3 className="text-sm font-mono font-bold text-yellow-800 dark:text-yellow-500 uppercase tracking-widest mb-1">Draft Mode</h3>
          <p className="text-sm text-yellow-700 dark:text-yellow-600 font-mono">You can edit these details. Once submitted for approval, the event will be locked.</p>
        </div>
        <button 
          onClick={handleSubmitForApproval}
          disabled={submitMutation.isPending || updateEvent.isPending}
          className="px-6 py-3 bg-yellow-600 text-white font-mono font-bold text-xs tracking-widest hover:bg-yellow-700 transition-colors uppercase flex items-center gap-2 whitespace-nowrap disabled:opacity-50"
        >
          <Send className="w-4 h-4" />
          {submitMutation.isPending ? 'Submitting...' : 'Submit for Approval'}
        </button>
      </div>

      <form onSubmit={handleSaveDraft} className="space-y-8 p-6 border border-stitch-outline-variant bg-stitch-surface-container-lowest">
        
        {/* Basic Info */}
        <section className="space-y-4">
          <h2 className="text-xs font-mono font-bold tracking-[0.2em] text-stitch-on-surface uppercase border-b border-stitch-outline-variant pb-1.5 mb-4">Basic Details</h2>
          
          <div>
            <label className="block text-[10px] font-mono font-bold text-stitch-secondary uppercase tracking-widest mb-1.5">Event Title *</label>
            <input 
              required
              minLength={3}
              maxLength={255}
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              className="w-full bg-stitch-surface border border-stitch-outline-variant px-3 py-2 text-sm font-sans text-stitch-on-surface focus:border-stitch-primary focus:outline-none transition-colors"
            />
          </div>

          <div>
            <label className="block text-[10px] font-mono font-bold text-stitch-secondary uppercase tracking-widest mb-1.5">Description</label>
            <textarea 
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={4}
              className="w-full bg-stitch-surface border border-stitch-outline-variant px-3 py-2 text-sm font-sans text-stitch-on-surface focus:border-stitch-primary focus:outline-none transition-colors"
            />
          </div>
        </section>

        {/* Date & Time */}
        <section className="space-y-4">
          <h2 className="text-xs font-mono font-bold tracking-[0.2em] text-stitch-on-surface uppercase border-b border-stitch-outline-variant pb-1.5 mb-4">Date & Time</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-mono font-bold text-stitch-secondary uppercase tracking-widest mb-1.5">Start Date *</label>
              <input 
                required
                type="date"
                name="startDate"
                value={formData.startDate}
                onChange={handleChange}
                className="w-full bg-stitch-surface border border-stitch-outline-variant px-3 py-2 text-sm font-mono text-stitch-on-surface focus:border-stitch-primary focus:outline-none transition-colors"
              />
            </div>
            <div>
              <label className="block text-[10px] font-mono font-bold text-stitch-secondary uppercase tracking-widest mb-1.5">Start Time *</label>
              <input 
                required
                type="time"
                name="startTime"
                value={formData.startTime}
                onChange={handleChange}
                className="w-full bg-stitch-surface border border-stitch-outline-variant px-3 py-2 text-sm font-mono text-stitch-on-surface focus:border-stitch-primary focus:outline-none transition-colors"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-mono font-bold text-stitch-secondary uppercase tracking-widest mb-1.5">End Date *</label>
              <input 
                required
                type="date"
                name="endDate"
                value={formData.endDate}
                onChange={handleChange}
                className="w-full bg-stitch-surface border border-stitch-outline-variant px-3 py-2 text-sm font-mono text-stitch-on-surface focus:border-stitch-primary focus:outline-none transition-colors"
              />
            </div>
            <div>
              <label className="block text-[10px] font-mono font-bold text-stitch-secondary uppercase tracking-widest mb-1.5">End Time *</label>
              <input 
                required
                type="time"
                name="endTime"
                value={formData.endTime}
                onChange={handleChange}
                className="w-full bg-stitch-surface border border-stitch-outline-variant px-3 py-2 text-sm font-mono text-stitch-on-surface focus:border-stitch-primary focus:outline-none transition-colors"
              />
            </div>
          </div>
        </section>

        {/* Location & Format */}
        <section className="space-y-4">
          <h2 className="text-xs font-mono font-bold tracking-[0.2em] text-stitch-on-surface uppercase border-b border-stitch-outline-variant pb-1.5 mb-4">Location & Format</h2>
          
          <div>
            <label className="block text-[10px] font-mono font-bold text-stitch-secondary uppercase tracking-widest mb-1.5">Location Name</label>
            <input 
              type="text"
              name="location_name"
              value={formData.location_name}
              onChange={handleChange}
              className="w-full bg-stitch-surface border border-stitch-outline-variant px-3 py-2 text-sm font-sans text-stitch-on-surface focus:border-stitch-primary focus:outline-none transition-colors"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-mono font-bold text-stitch-secondary uppercase tracking-widest mb-1.5">Event Type</label>
              <select 
                name="event_type"
                value={formData.event_type}
                onChange={handleChange}
                className="w-full bg-stitch-surface border border-stitch-outline-variant px-3 py-2 text-sm font-mono text-stitch-on-surface focus:border-stitch-primary focus:outline-none transition-colors appearance-none"
              >
                <option value="WORKSHOP">Workshop</option>
                <option value="HACKATHON">Hackathon</option>
                <option value="SEMINAR">Seminar</option>
                <option value="SOCIAL">Social</option>
                <option value="COMPETITION">Competition</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            
            <div>
              <label className="block text-[10px] font-mono font-bold text-stitch-secondary uppercase tracking-widest mb-1.5">Visibility</label>
              <select 
                name="visibility"
                value={formData.visibility}
                onChange={handleChange}
                className="w-full bg-stitch-surface border border-stitch-outline-variant px-3 py-2 text-sm font-mono text-stitch-on-surface focus:border-stitch-primary focus:outline-none transition-colors appearance-none"
              >
                <option value="PUBLIC">Public</option>
                <option value="PRIVATE">Private</option>
                <option value="UNLISTED">Unlisted</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-mono font-bold text-stitch-secondary uppercase tracking-widest mb-1.5">Attendance Type</label>
              <select 
                name="attendance_type"
                value={formData.attendance_type}
                onChange={handleChange}
                className="w-full bg-stitch-surface border border-stitch-outline-variant px-3 py-2 text-sm font-mono text-stitch-on-surface focus:border-stitch-primary focus:outline-none transition-colors appearance-none"
              >
                <option value="SINGLE">Single Session</option>
                <option value="MULTI_SESSION">Multi Session</option>
              </select>
            </div>
          </div>
          
          <div className="mt-6 pt-6 border-t border-stitch-outline-variant">
            <h3 className="text-xs font-mono font-bold tracking-widest text-stitch-on-surface uppercase mb-4">Audience & Access</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-mono font-bold text-stitch-secondary uppercase tracking-widest mb-1.5">Audience</label>
                <select 
                  name="audience"
                  value={formData.audience}
                  onChange={handleChange}
                  className="w-full bg-stitch-surface border border-stitch-outline-variant px-3 py-2 text-sm font-mono text-stitch-on-surface focus:border-stitch-primary focus:outline-none transition-colors appearance-none"
                >
                  <option value="ALL_STUDENTS">All Students</option>
                  <option value="SPECIFIC_BATCHES">Specific Batches</option>
                </select>
              </div>

              {formData.audience === 'SPECIFIC_BATCHES' && (
                <div>
                  <label className="block text-[10px] font-mono font-bold text-stitch-secondary uppercase tracking-widest mb-1.5">Eligible Batches</label>
                  <MultiSelect
                    options={batchesData?.map(b => ({ value: b.id, label: b.display_name })) || []}
                    selectedValues={formData.audience_batch_ids}
                    onChange={(values: string[]) => handleMultiSelectChange('audience_batch_ids', values)}
                    placeholder="Select batches..."
                  />
                </div>
              )}
            </div>

            {/* Note: PATCH /v1/events/:id does not currently support updating collaborating_club_ids per useUpdateEvent input, but we render it read-only if they exist, or disabled for now.
                We'll leave the input here, but updating it might require a backend endpoint or be unsupported in useUpdateEvent hook payload. */}
            <div className="mt-6">
              <label className="block text-[10px] font-mono font-bold text-stitch-secondary uppercase tracking-widest mb-1.5">Collaborating Clubs</label>
              <MultiSelect
                disabled
                options={eligibleClubs.map(c => ({ value: c.id, label: c.name }))}
                selectedValues={formData.collaborating_club_ids}
                onChange={(values: string[]) => handleMultiSelectChange('collaborating_club_ids', values)}
                placeholder="Select clubs..."
              />
              <p className="text-[10px] font-mono text-stitch-secondary mt-1">
                Collaborating clubs cannot be changed after creation.
              </p>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-stitch-outline-variant">
            <h3 className="text-xs font-mono font-bold tracking-widest text-stitch-on-surface uppercase mb-4">Registration & Capacity</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-mono font-bold text-stitch-secondary uppercase tracking-widest mb-1.5">Registration Type</label>
                <select 
                  name="registration_type"
                  value={formData.registration_type}
                  onChange={handleChange}
                  className="w-full bg-stitch-surface border border-stitch-outline-variant px-3 py-2 text-sm font-mono text-stitch-on-surface focus:border-stitch-primary focus:outline-none transition-colors appearance-none"
                >
                  <option value="INDIVIDUAL">Individual</option>
                  <option value="TEAM">Team</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-mono font-bold text-stitch-secondary uppercase tracking-widest mb-1.5">
                  {formData.registration_type === 'TEAM' ? "Maximum Teams" : "Maximum Participants"}
                </label>
                <input 
                  type="number"
                  min="1"
                  name="max_capacity"
                  value={formData.max_capacity}
                  onChange={handleChange}
                  placeholder="Leave empty for unlimited"
                  className="w-full bg-stitch-surface border border-stitch-outline-variant px-3 py-2 text-sm font-mono text-stitch-on-surface focus:border-stitch-primary focus:outline-none transition-colors"
                />
              </div>

              {formData.registration_type === 'TEAM' && (
                <>
                  <div>
                    <label className="block text-[10px] font-mono font-bold text-stitch-secondary uppercase tracking-widest mb-1.5">Minimum Team Size *</label>
                    <input 
                      required
                      type="number"
                      min="1"
                      name="minimum_team_size"
                      value={formData.minimum_team_size}
                      onChange={handleChange}
                      placeholder="e.g. 2"
                      className="w-full bg-stitch-surface border border-stitch-outline-variant px-3 py-2 text-sm font-mono text-stitch-on-surface focus:border-stitch-primary focus:outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono font-bold text-stitch-secondary uppercase tracking-widest mb-1.5">Maximum Team Size *</label>
                    <input 
                      required
                      type="number"
                      min="1"
                      name="maximum_team_size"
                      value={formData.maximum_team_size}
                      onChange={handleChange}
                      placeholder="e.g. 4"
                      className="w-full bg-stitch-surface border border-stitch-outline-variant px-3 py-2 text-sm font-mono text-stitch-on-surface focus:border-stitch-primary focus:outline-none transition-colors"
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        </section>

        <div className="pt-6 border-t border-stitch-outline-variant flex justify-end gap-4">
          <Link 
            href={`/student/events/${eventId}/manage`}
            className="px-6 py-3 border border-stitch-on-surface text-stitch-on-surface font-mono font-bold text-xs tracking-widest hover:bg-stitch-surface transition-colors uppercase"
          >
            Cancel
          </Link>
          <button 
            type="submit"
            disabled={updateEvent.isPending || submitMutation.isPending}
            className="px-8 py-3 border border-stitch-primary text-stitch-primary font-mono font-bold text-xs tracking-widest hover:bg-stitch-primary hover:text-stitch-on-primary transition-colors uppercase flex items-center gap-2 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {updateEvent.isPending ? 'Saving...' : 'Save Draft'}
          </button>
        </div>

      </form>
    </div>
  );
}
