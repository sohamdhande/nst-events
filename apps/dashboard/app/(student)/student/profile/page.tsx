'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useTheme } from 'next-themes';
import { useCurrentUser } from '../../../../hooks/useCurrentUser';
import { useLogout } from '../../../../hooks/useLogout';
import { 
  useNotificationPreferences, 
  useUpdateNotificationPreferences, 
  NotificationPreferences 
} from '../../../../hooks/useNotificationPreferences';
import { LogOut, ChevronRight } from 'lucide-react';
import { Modal } from '../../../../components/ui/Modal';

export default function StudentProfilePage() {
  const { data: user, isLoading: isLoadingUser, isError: isErrorUser, error: errorUser, refetch: refetchUser } = useCurrentUser();
  const { mutate: logout, isPending: isLoggingOut } = useLogout();
  const { theme, setTheme } = useTheme();
  
  const { data: prefData, isLoading: isLoadingPrefs, isError: isErrorPrefs, refetch: refetchPrefs } = useNotificationPreferences();
  const { mutate: updatePref, isPending: isUpdatingPref } = useUpdateNotificationPreferences();

  const [mounted, setMounted] = useState(false);
  const [isSignOutModalOpen, setIsSignOutModalOpen] = useState(false);
  const [updatingKey, setUpdatingKey] = useState<keyof NotificationPreferences | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (isLoadingUser) {
    return (
      <div className="w-full max-w-[800px] mx-auto px-6 py-8 animate-pulse space-y-6">
        <div className="h-8 w-48 bg-stitch-surface-variant rounded-none"></div>
        <div className="p-6 border border-stitch-outline-variant space-y-4">
          <div className="w-14 h-14 bg-stitch-surface-variant rounded-none"></div>
          <div className="h-6 w-1/3 bg-stitch-surface-variant rounded-none"></div>
          <div className="h-4 w-1/2 bg-stitch-surface-variant rounded-none"></div>
        </div>
      </div>
    );
  }

  if (isErrorUser || !user) {
    return (
      <div className="w-full max-w-[800px] mx-auto px-6 py-12 text-center">
        <p className="text-sm font-mono text-stitch-secondary mb-4">
          {errorUser?.message || "Failed to load profile."}
        </p>
        <button
          onClick={() => refetchUser()}
          className="px-4 py-2 bg-stitch-on-surface text-stitch-surface-container-lowest font-mono text-xs uppercase tracking-widest hover:opacity-80"
        >
          Retry
        </button>
      </div>
    );
  }

  // Derive Student ID from local part of institutional email (uppercase)
  const studentId = user.email ? user.email.split('@')[0].toUpperCase() : null;

  // Safely extract academic metadata
  const getAcademicIdentityText = () => {
    const batch = user.academic_profile?.batch;
    if (!batch) return null;

    const graduationYear = typeof batch.graduation_year === 'number' ? batch.graduation_year : null;
    const batchText = graduationYear ? `Batch of ${graduationYear}` : null;

    const program = batch.program;
    const programName = typeof program?.name === 'string' && program.name.trim() !== '' ? program.name.trim() : null;
    const programCode = typeof program?.code === 'string' && program.code.trim() !== '' ? program.code.trim() : null;
    const programText = programName || programCode || null;

    if (batchText && programText) {
      return `${batchText} · ${programText}`;
    }
    if (batchText) {
      return batchText;
    }
    if (programText) {
      return programText;
    }
    return null;
  };

  const academicIdentityText = getAcademicIdentityText();
  const clubMemberships = user.club_memberships || [];

  const handleTogglePreference = (key: keyof NotificationPreferences, currentValue: boolean) => {
    setUpdateError(null);
    setUpdatingKey(key);
    updatePref(
      { [key]: !currentValue },
      {
        onSettled: () => {
          setUpdatingKey(null);
        },
        onError: () => {
          setUpdateError("Couldn't save this setting. Please try again.");
        },
      }
    );
  };

  return (
    <div className="w-full max-w-[800px] mx-auto px-6 py-6 md:py-8 font-sans text-stitch-on-surface">
      {/* SIGN OUT CONFIRMATION MODAL */}
      <Modal
        isOpen={isSignOutModalOpen}
        onClose={() => !isLoggingOut && setIsSignOutModalOpen(false)}
        title="SIGN OUT"
      >
        <div className="p-6 pt-0">
          <p className="text-sm text-stitch-on-surface-variant mb-6">
            Are you sure you want to sign out of your account on this device?
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => setIsSignOutModalOpen(false)}
              disabled={isLoggingOut}
              className="w-full sm:w-auto px-5 py-2.5 border border-stitch-on-surface text-stitch-on-surface font-mono font-bold text-xs tracking-widest uppercase hover:bg-stitch-surface transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={() => logout()}
              disabled={isLoggingOut}
              className="w-full sm:flex-1 px-5 py-2.5 bg-red-600 text-white font-mono font-bold text-xs tracking-widest uppercase hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              {isLoggingOut ? 'Signing out...' : 'Sign Out'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Page Title */}
      <div className="mb-6 border-b border-stitch-outline-variant pb-4">
        <h1
          className="text-3xl font-black tracking-tight text-stitch-on-surface mb-1"
          style={{ fontFamily: 'Syne, sans-serif' }}
        >
          Profile
        </h1>
        <p className="text-xs font-mono text-stitch-secondary uppercase tracking-wider">
          Manage your account and preferences
        </p>
      </div>

      <div className="space-y-6">
        {/* 1. IDENTITY CARD */}
        <section className="p-4 md:p-5 border border-stitch-outline-variant bg-stitch-surface-container-lowest">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="w-14 h-14 bg-stitch-on-surface text-stitch-surface-container-lowest flex items-center justify-center font-bold text-xl flex-shrink-0 font-mono">
              {user.full_name ? user.full_name.charAt(0).toUpperCase() : 'U'}
            </div>
            <div className="space-y-1 min-w-0 flex-1">
              <h2
                className="text-xl font-bold text-stitch-on-surface tracking-tight leading-tight truncate"
                style={{ fontFamily: 'Syne, sans-serif' }}
              >
                {user.full_name || 'Student'}
              </h2>

              {/* Student ID & Email */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-mono text-stitch-on-surface-variant">
                {studentId && (
                  <span className="font-bold text-stitch-on-surface tracking-wider uppercase">
                    ID: {studentId}
                  </span>
                )}
                {user.email && (
                  <span className="text-stitch-secondary truncate">
                    {user.email}
                  </span>
                )}
              </div>

              {/* Academic Metadata & Role Badges */}
              <div className="flex flex-wrap items-center gap-2 pt-2">
                <span className="px-2 py-0.5 bg-stitch-surface-variant border border-stitch-outline-variant text-[11px] font-mono font-bold uppercase tracking-wider text-stitch-on-surface">
                  {user.global_role === 'STUDENT' ? 'Student' : user.global_role.replace(/_/g, ' ')}
                </span>

                {academicIdentityText && (
                  <span className="px-2 py-0.5 bg-stitch-surface border border-stitch-outline-variant text-[11px] font-mono text-stitch-on-surface-variant tracking-wide">
                    {academicIdentityText}
                  </span>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* 2. YOUR CAMPUS (Belonging) */}
        <section className="space-y-2">
          <h2 className="text-xs font-mono font-bold tracking-[0.2em] text-stitch-secondary uppercase">
            Your Campus
          </h2>
          <div className="border border-stitch-outline-variant bg-stitch-surface-container-lowest divide-y divide-stitch-outline-variant">
            {clubMemberships.length > 0 ? (
              clubMemberships.map((m) => (
                <Link
                  key={m.club_id}
                  href={`/student/campus/clubs/${m.club_id}`}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-stitch-surface transition-colors group"
                >
                  <div>
                    <div className="text-sm font-semibold text-stitch-on-surface mb-0.5">{m.club_name}</div>
                    <div className="text-[10px] text-stitch-secondary font-mono uppercase tracking-widest">
                      {m.role === 'CLUB_ADMIN' ? 'Club Admin' : m.role === 'CORE_MEMBER' ? 'Core Member' : m.role === 'FACULTY_MENTOR' ? 'Faculty Mentor' : 'Member'}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase tracking-widest text-stitch-on-surface group-hover:translate-x-0.5 transition-transform">
                    <span>{m.role === 'CLUB_ADMIN' ? 'MANAGE' : 'VIEW'}</span>
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </Link>
              ))
            ) : (
              <div className="p-4 flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-stitch-on-surface mb-0.5">My Clubs</div>
                  <div className="text-xs text-stitch-secondary font-mono">You're not part of any clubs yet.</div>
                </div>
              </div>
            )}
            <Link
              href="/student/campus/clubs"
              className="p-4 flex items-center justify-center gap-2 text-xs font-mono font-bold uppercase tracking-widest text-stitch-primary hover:bg-stitch-surface transition-colors bg-stitch-surface-variant/30"
            >
              Explore All Clubs
            </Link>
          </div>
        </section>

        {/* 3. STAY IN THE LOOP */}
        <section className="space-y-2">
          <h2 className="text-xs font-mono font-bold tracking-[0.2em] text-stitch-secondary uppercase">
            Stay in the Loop
          </h2>
          {updateError && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-mono mb-2">
              {updateError}
            </div>
          )}
          <div className="border border-stitch-outline-variant bg-stitch-surface-container-lowest divide-y divide-stitch-outline-variant">
            {isLoadingPrefs ? (
              <div className="p-4 animate-pulse space-y-3">
                <div className="h-4 w-1/3 bg-stitch-surface-variant rounded"></div>
                <div className="h-3 w-1/2 bg-stitch-surface-variant rounded"></div>
              </div>
            ) : isErrorPrefs ? (
              <div className="p-4 text-xs font-mono text-stitch-secondary flex items-center justify-between">
                <span>Couldn't load notification preferences.</span>
                <button onClick={() => refetchPrefs()} className="font-bold underline text-stitch-on-surface">
                  Retry
                </button>
              </div>
            ) : (
              [
                {
                  key: 'pushEnabled' as const,
                  label: 'Push Notifications',
                  sub: 'Receive push notifications from NST Events.',
                },
                {
                  key: 'eventReminders' as const,
                  label: 'Event Reminders',
                  sub: "Reminders for events you're registered for.",
                },
                {
                  key: 'clubAnnouncements' as const,
                  label: 'Club Announcements',
                  sub: "Updates from clubs you're part of.",
                },
                {
                  key: 'attendanceAlerts' as const,
                  label: 'Attendance Alerts',
                  sub: 'Check-in windows and dispute updates.',
                },
              ].map((item) => {
                const isChecked = prefData ? !!prefData[item.key] : false;
                const isBusy = isUpdatingPref && updatingKey === item.key;
                return (
                  <div key={item.key} className="p-4 flex items-center justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-stitch-on-surface mb-0.5">{item.label}</div>
                      <div className="text-xs text-stitch-secondary">{item.sub}</div>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={isChecked}
                      aria-label={item.label}
                      disabled={isBusy}
                      onClick={() => handleTogglePreference(item.key, isChecked)}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-none border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        isChecked ? 'bg-stitch-on-surface' : 'bg-stitch-surface-variant'
                      } ${isBusy ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <span
                        aria-hidden="true"
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-none bg-stitch-surface-container-lowest shadow ring-0 transition duration-200 ease-in-out ${
                          isChecked ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* 4. APPEARANCE */}
        <section className="space-y-2">
          <h2 className="text-xs font-mono font-bold tracking-[0.2em] text-stitch-secondary uppercase">
            Appearance
          </h2>
          <div className="border border-stitch-outline-variant bg-stitch-surface-container-lowest p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-stitch-on-surface mb-0.5">Theme</div>
              <div className="text-xs text-stitch-secondary">Choose how NST Events appears on your device.</div>
            </div>
            {mounted ? (
              <div className="inline-flex p-1 bg-stitch-surface-variant border border-stitch-outline-variant font-mono text-xs w-fit">
                {(['system', 'light', 'dark'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTheme(t)}
                    className={`px-3 py-1 uppercase transition-colors ${
                      theme === t
                        ? 'bg-stitch-on-surface text-stitch-surface-container-lowest font-bold'
                        : 'text-stitch-on-surface-variant hover:text-stitch-on-surface'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            ) : (
              <div className="h-7 w-36 bg-stitch-surface-variant animate-pulse border border-stitch-outline-variant"></div>
            )}
          </div>
        </section>

        {/* 5. ACCOUNT */}
        <section className="space-y-2 pt-2">
          <h2 className="text-xs font-mono font-bold tracking-[0.2em] text-stitch-secondary uppercase">
            Account
          </h2>
          <div className="border border-stitch-outline-variant bg-stitch-surface-container-lowest p-4 flex items-center justify-between">
            <button
              onClick={() => setIsSignOutModalOpen(true)}
              className="flex items-center gap-2 text-xs font-mono font-bold text-red-600 hover:text-red-800 uppercase tracking-widest transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
