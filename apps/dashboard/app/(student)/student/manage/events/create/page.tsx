'use client';

import React, { useState, useEffect } from 'react';
import { useClubAdmin } from '../../../../../../components/layout/ClubAdminProvider';
import { useCreateEvent, useSubmitEventForApproval } from '../../../../../../hooks/useCreateEvent';
import { useCurrentUser } from '../../../../../../hooks/useCurrentUser';
import { useAcademicBatches } from '../../../../../../hooks/useAcademicBatches';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useClubs } from '../../../../../../hooks/useClubs';
import { MultiSelect } from '../../../../components/MultiSelect';

export default function CreateEventPage() {
  const { activeClubId, isHydrated } = useClubAdmin();
  const router = useRouter();
  const createEvent = useCreateEvent();
  const submitApproval = useSubmitEventForApproval();
  
  const [submitAction, setSubmitAction] = useState<'DRAFT' | 'SUBMIT'>('DRAFT');
  const { data: currentUser } = useCurrentUser();
  const { data: clubsData } = useClubs();
  const { data: batchesData } = useAcademicBatches();

  const isGlobalAdmin = currentUser?.global_role === 'PLATFORM_ADMIN' || currentUser?.global_role === 'FACULTY_ADMIN';

  const eligibleClubs = clubsData?.data?.map(c => ({ id: c.id, name: c.name })) || [];

  const collaboratingClubsOptions = eligibleClubs.filter(c => c.id !== activeClubId);

  useEffect(() => {
    if (isHydrated && !activeClubId) {
      router.push('/student/home');
    }
  }, [isHydrated, activeClubId, router]);

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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleMultiSelectChange = (name: string, values: string[]) => {
    setFormData(prev => ({ ...prev, [name]: values }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeClubId) return;

    // Combine date and time
    const start_time = new Date(`${formData.startDate}T${formData.startTime}`).toISOString();
    const end_time = new Date(`${formData.endDate}T${formData.endTime}`).toISOString();

    const payload = {
      title: formData.title,
      description: formData.description,
      start_time,
      end_time,
      location_name: formData.location_name,
      event_type: formData.event_type,
      visibility: formData.visibility,
      registration_type: formData.registration_type,
      attendance_type: formData.attendance_type,
      max_capacity: formData.max_capacity ? parseInt(formData.max_capacity) : undefined,
      audience: formData.audience as any,
      audience_batch_ids: formData.audience === 'SPECIFIC_BATCHES' ? formData.audience_batch_ids : undefined,
      club_ids: [
        { club_id: activeClubId, is_primary: true },
        ...formData.collaborating_club_ids.map(id => ({ club_id: id, is_primary: false }))
      ],
      metadata: formData.registration_type === 'TEAM' ? {
        minimum_team_size: formData.minimum_team_size ? parseInt(formData.minimum_team_size) : undefined,
        maximum_team_size: formData.maximum_team_size ? parseInt(formData.maximum_team_size) : undefined,
      } : undefined,
    };

    try {
      const event = await createEvent.mutateAsync(payload);
      
      if (submitAction === 'SUBMIT') {
        await submitApproval.mutateAsync(event.id);
      }
      
      router.push(`/student/events/${event.id}/manage`); // Redirect to the event's manage dashboard
    } catch (error) {
      console.error('Failed to create/submit event:', error);
      alert('Failed to save event. Please try again.');
    }
  };

  if (!isHydrated) return null;

  return (
    <div className="w-full max-w-[800px] mx-auto px-6 py-6 md:px-12 md:py-8">
      
      <Link 
        href="/student/manage/events"
        className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-widest text-stitch-on-surface hover:text-stitch-secondary transition-colors mb-6"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Events
      </Link>

      <div className="mb-8">
        <div className="text-[11px] font-mono font-bold tracking-widest uppercase mb-1 text-stitch-secondary">
          CREATE EVENT
        </div>
        <h1 className="text-3xl md:text-4xl font-black text-stitch-on-surface tracking-tight leading-tight uppercase" style={{ fontFamily: 'Syne, sans-serif' }}>
          New Event
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8 p-6 border border-stitch-outline-variant bg-stitch-surface-container-lowest">
        
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
              placeholder="e.g. AI Hackathon 2026"
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
              placeholder="What is this event about?"
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
              placeholder="e.g. Auditorium 1"
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

            <div className="mt-6">
              <label className="block text-[10px] font-mono font-bold text-stitch-secondary uppercase tracking-widest mb-1.5">Collaborating Clubs</label>
              <MultiSelect
                options={collaboratingClubsOptions.map(c => ({ value: c.id, label: c.name }))}
                selectedValues={formData.collaborating_club_ids}
                onChange={(values: string[]) => handleMultiSelectChange('collaborating_club_ids', values)}
                placeholder="Select clubs..."
              />
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
            href="/student/manage/events"
            className="px-6 py-3 border border-stitch-on-surface text-stitch-on-surface font-mono font-bold text-xs tracking-widest hover:bg-stitch-surface transition-colors uppercase"
          >
            Cancel
          </Link>
          <button 
            type="submit"
            onClick={() => setSubmitAction('DRAFT')}
            disabled={createEvent.isPending || submitApproval.isPending}
            className="px-6 py-3 border border-stitch-primary text-stitch-primary font-mono font-bold text-xs tracking-widest hover:bg-stitch-primary hover:text-stitch-on-primary transition-colors uppercase disabled:opacity-50"
          >
            {createEvent.isPending && submitAction === 'DRAFT' ? 'Saving...' : 'Save Draft'}
          </button>
          <button 
            type="submit"
            onClick={() => setSubmitAction('SUBMIT')}
            disabled={createEvent.isPending || submitApproval.isPending}
            className="px-8 py-3 bg-yellow-600 text-white font-mono font-bold text-xs tracking-widest hover:bg-yellow-700 transition-colors uppercase disabled:opacity-50"
          >
            {(createEvent.isPending || submitApproval.isPending) && submitAction === 'SUBMIT' ? 'Submitting...' : 'Submit for Approval'}
          </button>
        </div>

      </form>
    </div>
  );
}
