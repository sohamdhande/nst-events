'use client';

import React, { use, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useEventDetail } from '../../../../../../../hooks/useEventDetail';
import { useAttendance, useCreateSession, useUpdateSession, useGenerateQr, useManualAttendance, useAttendanceDisputes, useResolveAttendanceDispute, AttendanceDispute } from '../../../../../../../hooks/useAttendance';
import { useRegistrationsList } from '../../../../../../../hooks/useRegistrations';
import { useCurrentUser } from '../../../../../../../hooks/useCurrentUser';
import { canMarkAttendanceManually } from '../../../../../../../lib/auth-helpers';
import { resolveEventLockState } from '../../../../../../../lib/event-utils';
import { getWebAuthStore } from '../../../../../../../lib/auth-store';
import { QrCode, UserCheck, ShieldAlert, Lock, Plus, Search, CheckCircle, Check, XCircle, RefreshCw, AlertTriangle, Download } from 'lucide-react';
import clsx from 'clsx';
import { QRCodeSVG } from 'qrcode.react';
import { Modal } from '../../../../../../../components/ui/Modal';

export default function ManageAttendancePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: eventId } = use(params);
  const { data: event, isLoading: isLoadingEvent } = useEventDetail(eventId);
  const { data: currentUser } = useCurrentUser();

  // Authorization check
  const auth = useMemo(() => {
    if (!currentUser || !event) return { canManageAttendance: false, canMarkManually: false };
    const isGlobal = currentUser.global_role === 'PLATFORM_ADMIN' || currentUser.global_role === 'FACULTY_ADMIN';
    const userAdminClubs = currentUser.club_memberships.filter(m => m.role === 'CLUB_ADMIN' || m.role === 'CORE_MEMBER').map(m => m.club_id);
    const userMentorClubs = currentUser.club_memberships.filter(m => m.role === 'FACULTY_MENTOR').map(m => m.club_id);
    const isClubAdminOrCore = event.eventClubs?.some(ec => userAdminClubs.includes(ec.clubId)) ?? false;
    const isMentor = event.eventClubs?.some(ec => userMentorClubs.includes(ec.clubId)) ?? false;
    
    const canManage = isGlobal || isClubAdminOrCore || isMentor;
    const canManual = canMarkAttendanceManually(currentUser, event);
    
    return {
      canManageAttendance: canManage,
      canMarkManually: canManual
    };
  }, [currentUser, event]);

  const lockState = event ? resolveEventLockState(event) : 'UNLOCKED';
  const isEffectivelyLocked = lockState !== 'UNLOCKED';

  // Sessions handling (Multi-Session & Single-Session Support)
  const sessions = useMemo(() => event?.attendanceSessions || [], [event?.attendanceSessions]);
  const [activeSessionId, setActiveSessionId] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (sessions.length > 0) {
      if (!activeSessionId || !sessions.some(s => s.id === activeSessionId)) {
        setActiveSessionId(sessions[0].id);
      }
    }
  }, [sessions, activeSessionId]);

  const activeSession = useMemo(() => sessions.find(s => s.id === activeSessionId), [sessions, activeSessionId]);

  const isSessionActive = useMemo(() => {
    if (!activeSession || !activeSession.openAt || !activeSession.closeAt) return false;
    const now = new Date();
    const openAt = new Date(activeSession.openAt);
    const closeAt = new Date(activeSession.closeAt);
    return now >= openAt && now <= closeAt;
  }, [activeSession]);

  // Session Mutations
  const createSession = useCreateSession(eventId);
  const updateSession = useUpdateSession(eventId, activeSessionId || '');
  const { mutate: generateQr, isPending: isGeneratingQr } = useGenerateQr();

  // Attendees list query (scoped strictly to activeSessionId)
  const { 
    data: attendanceData, 
    isLoading: isLoadingAttendance,
    fetchNextPage: fetchNextAttendancePage,
    hasNextPage: hasNextAttendancePage,
    isFetchingNextPage: isFetchingNextAttendancePage
  } = useAttendance(eventId, activeSessionId);

  const attendees = useMemo(() => attendanceData?.pages.flatMap(p => p.data) || [], [attendanceData]);

  // Manual Attendance Marking
  const manualAttendance = useManualAttendance(eventId);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [manualMarkStatus, setManualMarkStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Student roster data source: REGISTERED event students ONLY (event-scoped)
  const { data: registrationsData, isLoading: isLoadingRegistrations } = useRegistrationsList(eventId, 'REGISTERED');

  const registeredStudents = useMemo(() => {
    const list = registrationsData?.pages.flatMap(p => p.data) || [];
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase().trim();
    return list.filter(r => 
      (r.user.fullName && r.user.fullName.toLowerCase().includes(q)) ||
      (r.user.email && r.user.email.toLowerCase().includes(q))
    );
  }, [registrationsData, searchQuery]);

  // Disputes
  const { data: disputesData, isLoading: isLoadingDisputes } = useAttendanceDisputes(eventId);
  const resolveMutation = useResolveAttendanceDispute(eventId);
  
  const [resolveModalOpen, setResolveModalOpen] = useState(false);
  const [selectedDispute, setSelectedDispute] = useState<AttendanceDispute | null>(null);
  const [resolveStatus, setResolveStatus] = useState<'APPROVED' | 'REJECTED'>('APPROVED');
  const [reviewNotes, setReviewNotes] = useState('');
  
  const disputes = useMemo(() => disputesData?.pages.flatMap(p => p.data) || [], [disputesData]);

  const handleResolveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDispute) return;
    try {
      await resolveMutation.mutateAsync({
        id: selectedDispute.id,
        resolution: resolveStatus,
        review_notes: reviewNotes,
      });
      setResolveModalOpen(false);
      setSelectedDispute(null);
      setReviewNotes('');
    } catch (err: any) {
      alert(err.message || 'Failed to resolve dispute');
    }
  };

  // CSV Export
  const handleExport = () => {
    const token = getWebAuthStore().accessToken;
    fetch(`/v1/events/${eventId}/attendance/export`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
    .then(res => res.blob())
    .then(blob => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `attendance-export-${eventId}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    })
    .catch(err => {
      console.error('Failed to export', err);
      alert('Failed to export attendance data.');
    });
  };

  // QR State & Loop
  const [qrData, setQrData] = useState<{ payload: string; expiresAt: string } | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [isExpired, setIsExpired] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isEndSessionModalOpen, setIsEndSessionModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newSessionTitle, setNewSessionTitle] = useState('');

  const qrRefreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isRefreshingRef = useRef(false);
  const retryCountRef = useRef(0);
  const doRefreshRef = useRef<((sid: string) => void) | null>(null);

  const MIN_REFRESH_INTERVAL_MS = process.env.NODE_ENV === 'test' ? 1000 : 30_000;

  const doRefresh = useCallback((sid: string) => {
    if (!isSessionActive) return;
    if (isRefreshingRef.current) return;
    isRefreshingRef.current = true;
    
    const scheduleRefresh = (session_id: string, delayMs: number) => {
      if (qrRefreshTimeoutRef.current) clearTimeout(qrRefreshTimeoutRef.current);
      qrRefreshTimeoutRef.current = setTimeout(() => {
        isRefreshingRef.current = false;
        if (doRefreshRef.current) doRefreshRef.current(session_id);
      }, delayMs);
    };
    
    generateQr(sid, {
      onSuccess: (res) => {
        if (!isSessionActive) {
          isRefreshingRef.current = false;
          return;
        }
        if (res.qr_payload && res.expires_at) {
          const backendExpiresMs = new Date(res.expires_at).getTime();
          const minExpiresMs = Date.now() + MIN_REFRESH_INTERVAL_MS;
          const effectiveExpiresMs = Math.max(backendExpiresMs, minExpiresMs);
          const effectiveExpiresAt = new Date(effectiveExpiresMs).toISOString();

          setQrData({ payload: res.qr_payload, expiresAt: effectiveExpiresAt });
          setRefreshError(null);
          setIsExpired(false);
          retryCountRef.current = 0;
          scheduleRefresh(sid, Math.max(500, effectiveExpiresMs - Date.now() - 2000));
        } else {
           setRefreshError('Invalid QR response');
           retryCountRef.current += 1;
           if (retryCountRef.current <= 3) scheduleRefresh(sid, 5000);
           else setIsExpired(true);
        }
        isRefreshingRef.current = false;
      },
      onError: (err: any) => {
        const is429 = err && err.status === 429;
        if (is429) {
          retryCountRef.current += 1;
          setRefreshError(null);
          if (retryCountRef.current <= 5) scheduleRefresh(sid, 10_000);
          else setIsExpired(true);
        } else {
          setRefreshError(err.message || 'Failed to generate QR');
          retryCountRef.current += 1;
          if (retryCountRef.current <= 3) scheduleRefresh(sid, 5000);
          else setIsExpired(true);
        }
        isRefreshingRef.current = false;
      }
    });
  }, [generateQr, isSessionActive, MIN_REFRESH_INTERVAL_MS]);

  useEffect(() => {
    doRefreshRef.current = doRefresh;
  }, [doRefresh]);

  // Start QR Loop when session is active
  useEffect(() => {
    if (isSessionActive && activeSessionId && !qrData && !isGeneratingQr && !refreshError && !isExpired) {
      doRefresh(activeSessionId);
    }
  }, [isSessionActive, activeSessionId, qrData, isGeneratingQr, refreshError, isExpired, doRefresh]);

  // Stop QR loop when active session ends or changes
  useEffect(() => {
    if (!isSessionActive) {
      if (qrRefreshTimeoutRef.current) clearTimeout(qrRefreshTimeoutRef.current);
      setQrData(null);
      setCountdown(null);
      setIsExpired(false);
      setRefreshError(null);
      setIsFullscreen(false);
      isRefreshingRef.current = false;
      retryCountRef.current = 0;
    }
  }, [isSessionActive, activeSessionId]);

  // Visual Countdown
  useEffect(() => {
    if (!qrData) {
      setCountdown(null);
      return;
    }
    const expireTime = new Date(qrData.expiresAt).getTime();
    const tick = () => {
      const now = Date.now();
      const remainingSeconds = Math.max(0, Math.ceil((expireTime - now) / 1000));
      setCountdown(remainingSeconds);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [qrData]);

  useEffect(() => {
    return () => {
      if (qrRefreshTimeoutRef.current) clearTimeout(qrRefreshTimeoutRef.current);
    };
  }, []);
  
  // Escape key for fullscreen
  useEffect(() => {
    if (!isFullscreen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsFullscreen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  // Format Helper
  const formatTime = (isoString?: string | null) => {
    if (!isoString) return '--:--';
    return new Intl.DateTimeFormat('en-US', { timeStyle: 'short' }).format(new Date(isoString));
  };

  // Loading state
  if (isLoadingEvent) {
    return (
      <div className="w-full h-32 flex items-center justify-center border border-stitch-outline-variant bg-stitch-surface">
        <div className="animate-pulse flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-stitch-on-surface border-t-transparent rounded-full animate-spin"></div>
          <span className="text-[10px] font-mono uppercase tracking-widest text-stitch-secondary">Loading Attendance...</span>
        </div>
      </div>
    );
  }

  // Access Denied state
  if (!auth.canManageAttendance) {
    return (
      <div className="p-8 border border-red-600/30 bg-red-500/5 text-center">
        <ShieldAlert className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h2 className="text-xl font-black text-stitch-on-surface uppercase tracking-tight mb-2" style={{ fontFamily: 'Syne, sans-serif' }}>
          Access Denied
        </h2>
        <p className="text-sm font-mono text-stitch-secondary uppercase tracking-widest max-w-md mx-auto">
          You are not authorized to manage attendance for this event.
        </p>
      </div>
    );
  }

  const handleStartSession = () => {
    if (!event) return;
    const now = new Date();
    const closeTime = new Date(now.getTime() + 60 * 60 * 1000); // 1 hr
    createSession.mutate({
      title: newSessionTitle.trim() || `Session ${sessions.length + 1}`,
      start_time: now.toISOString(),
      end_time: event.endTime || closeTime.toISOString(),
      open_at: now.toISOString(),
      close_at: closeTime.toISOString(),
      geofence_radius: 50
    }, {
      onSuccess: () => {
        setIsCreateModalOpen(false);
        setNewSessionTitle('');
      },
      onError: (err: any) => {
        alert(err.message || 'Failed to create session');
      }
    });
  };

  const handleEndSession = () => {
    if (!activeSession) return;
    setIsEndSessionModalOpen(true);
  };

  const confirmEndSession = () => {
    if (!activeSessionId) return;
    const now = new Date().toISOString();
    updateSession.mutate({ close_at: now }, {
      onSuccess: () => {
        setIsEndSessionModalOpen(false);
      },
      onError: (err: any) => {
        alert(err.message || 'Failed to end session');
      }
    });
  };

  const handleManualGenerate = () => {
    if (!activeSessionId) return;
    if (qrRefreshTimeoutRef.current) clearTimeout(qrRefreshTimeoutRef.current);
    retryCountRef.current = 0;
    setRefreshError(null);
    setIsExpired(false);
    doRefresh(activeSessionId);
  };

  const handleManualMarkSubmit = async () => {
    if (!activeSessionId || !selectedUserId) return;
    setManualMarkStatus(null);
    try {
      await manualAttendance.mutateAsync({
        session_id: activeSessionId,
        user_id: selectedUserId
      });
      setManualMarkStatus({ type: 'success', message: 'Attendance marked PRESENT successfully.' });
      setSelectedUserId(null);
    } catch (err: any) {
      setManualMarkStatus({ type: 'error', message: err.message || 'Failed to mark attendance manually.' });
    }
  };

  return (
    <div className="space-y-6 relative">

      {/* Lock Banner */}
      {isEffectivelyLocked && (
        <div className="p-4 border border-yellow-600/40 bg-yellow-500/10 flex items-center gap-3">
          <Lock className="w-5 h-5 text-yellow-600 flex-shrink-0" />
          <div>
            <span className="text-xs font-mono font-bold uppercase tracking-widest text-yellow-700 dark:text-yellow-400 block">
              Event Locked ({lockState})
            </span>
            <span className="text-xs text-stitch-secondary font-mono">
              Attendance management is read-only. Manual marking and QR generation are disabled.
            </span>
          </div>
        </div>
      )}
      
      {/* Session Selection (Multi-Session & Single-Session Support) */}
      <div className="p-6 border border-stitch-outline-variant bg-stitch-surface-container-lowest">
        
        {/* Session Selector Tabs */}
        {sessions.length > 0 && (
          <div className="mb-6 border-b border-stitch-outline-variant pb-4">
            <div className="flex justify-between items-center mb-3">
              <span className="text-[10px] font-mono font-bold tracking-[0.2em] text-stitch-secondary uppercase">
                {event?.attendanceType === 'MULTI_SESSION' || sessions.length > 1 ? 'Select Session' : 'Attendance Session'}
              </span>
              <div className="flex items-center gap-2">
                {auth.canManageAttendance && (
                  <button
                    onClick={handleExport}
                    className="flex items-center gap-1.5 px-3 py-1.5 border border-stitch-outline-variant text-stitch-secondary font-mono text-[10px] uppercase tracking-widest hover:bg-stitch-surface hover:text-stitch-on-surface transition-colors"
                  >
                    <Download className="w-3 h-3" /> Export CSV
                  </button>
                )}
                {!isEffectivelyLocked && (event?.attendanceType === 'MULTI_SESSION' || sessions.length === 0) && (
                  <button
                    onClick={() => {
                      setNewSessionTitle(`Session ${sessions.length + 1}`);
                      setIsCreateModalOpen(true);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 border border-stitch-primary text-stitch-primary font-mono text-[10px] uppercase tracking-widest hover:bg-stitch-primary hover:text-stitch-on-primary transition-colors"
                  >
                    <Plus className="w-3 h-3" /> New Session
                  </button>
                )}
              </div>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1">
              {sessions.map((sess, idx) => {
                const isSelected = sess.id === activeSessionId;
                const sessActive = !!sess.openAt && !!sess.closeAt && new Date(sess.openAt) <= new Date() && new Date(sess.closeAt) >= new Date();
                return (
                  <button
                    key={sess.id}
                    onClick={() => {
                      setActiveSessionId(sess.id);
                      setQrData(null);
                      setRefreshError(null);
                    }}
                    className={clsx(
                      "px-4 py-2 border text-xs font-mono uppercase tracking-widest transition-colors flex items-center gap-2 whitespace-nowrap",
                      isSelected
                        ? "bg-stitch-primary border-stitch-primary text-stitch-on-primary font-bold"
                        : "border-stitch-outline-variant bg-stitch-surface hover:bg-stitch-surface-container-lowest text-stitch-secondary hover:text-stitch-on-surface"
                    )}
                  >
                    <span className={clsx(
                      "w-2 h-2 rounded-full",
                      sessActive ? "bg-green-500" : "bg-red-500"
                    )}></span>
                    <span>{sess.title || `Session ${idx + 1}`}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Active Session Details & Controls */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h2 className="text-xs font-mono font-bold tracking-[0.2em] text-stitch-on-surface uppercase mb-1">
              {activeSession ? (activeSession.title || 'Attendance Session') : 'Attendance Session'}
            </h2>
            {activeSession ? (
              <div className="flex items-center gap-2">
                <span className={clsx(
                  "w-2 h-2 rounded-full",
                  isSessionActive ? "bg-green-500" : "bg-red-500"
                )}></span>
                <span className="text-sm font-semibold text-stitch-on-surface uppercase font-mono tracking-widest">
                  {isSessionActive ? "Active" : "Closed"}
                </span>
                <span className="text-xs font-mono text-stitch-secondary">
                  ({formatTime(activeSession.openAt)} - {formatTime(activeSession.closeAt)})
                </span>
              </div>
            ) : (
              <p className="text-sm text-stitch-secondary font-mono">No attendance session has been started.</p>
            )}
          </div>
          
          <div className="flex items-center gap-3">
            {!activeSession && !isEffectivelyLocked ? (
              <button 
                onClick={() => {
                  setNewSessionTitle('Main Session');
                  handleStartSession();
                }}
                disabled={createSession.isPending}
                className="px-6 py-3 bg-stitch-primary text-stitch-on-primary font-mono font-bold text-xs tracking-widest hover:opacity-80 transition-colors uppercase disabled:opacity-50"
              >
                {createSession.isPending ? 'Starting...' : 'Start Session'}
              </button>
            ) : (
              <>
                {/* Manual Marking Button - Authorized Club Admin / Platform Admin */}
                {!isEffectivelyLocked && activeSessionId && auth.canMarkManually && isSessionActive && (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedUserId(null);
                      setManualMarkStatus(null);
                      setIsManualModalOpen(true);
                    }}
                    className="px-5 py-3 border border-stitch-primary text-stitch-primary font-mono font-bold text-xs tracking-widest hover:bg-stitch-primary hover:text-stitch-on-primary transition-colors uppercase flex items-center gap-2"
                  >
                    <UserCheck className="w-4 h-4" /> Mark Manually
                  </button>
                )}

                {/* End Session Button */}
                {!isEffectivelyLocked && isSessionActive && (
                  <button 
                    onClick={handleEndSession}
                    disabled={updateSession.isPending}
                    className="px-5 py-3 border border-red-600 text-red-600 font-mono font-bold text-xs tracking-widest hover:bg-red-600 hover:text-white transition-colors uppercase disabled:opacity-50"
                  >
                    {updateSession.isPending ? 'Ending...' : 'End Session'}
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {isSessionActive && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Dynamic QR Display Area */}
            {qrData ? (
              <div 
                onClick={() => setIsFullscreen(true)}
                className="p-6 border border-stitch-outline-variant bg-stitch-surface flex flex-col items-center justify-center text-center cursor-pointer hover:border-stitch-primary transition-colors"
              >
                <div className="p-4 bg-white rounded-md mb-4 shadow-sm">
                  <QRCodeSVG value={qrData.payload} size={200} />
                </div>
                
                <h3 className="text-sm font-bold text-stitch-on-surface uppercase tracking-widest mb-1 flex items-center gap-2" style={{ fontFamily: 'Syne, sans-serif' }}>
                  <QrCode className="w-4 h-4" /> Click to Present
                </h3>
                
                {isExpired ? (
                  <p className="text-xs text-red-500 font-mono mt-2 uppercase tracking-widest">QR expired. Click refresh.</p>
                ) : refreshError ? (
                  <p className="text-xs text-red-500 font-mono mt-2 uppercase tracking-widest">Error: {refreshError}. Retrying...</p>
                ) : (
                  <div className="flex items-center gap-2 mt-2">
                    {isGeneratingQr && <RefreshCw className="w-3 h-3 text-stitch-secondary animate-spin" />}
                    <p className="text-xs text-stitch-secondary font-mono tracking-widest uppercase">
                      Refreshing in {countdown ?? '-'}s
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-6 border border-stitch-outline-variant bg-stitch-surface flex flex-col items-center justify-center text-center">
                <QrCode className="w-8 h-8 text-stitch-secondary mb-3" />
                <h3 className="text-sm font-bold text-stitch-on-surface uppercase tracking-widest mb-2" style={{ fontFamily: 'Syne, sans-serif' }}>Display QR Code</h3>
                {isGeneratingQr ? (
                  <p className="text-xs text-stitch-secondary font-mono flex items-center gap-2 tracking-widest uppercase">
                    <RefreshCw className="w-3 h-3 animate-spin" /> Generating...
                  </p>
                ) : (
                  <button 
                    onClick={handleManualGenerate}
                    className="px-4 py-2 border border-stitch-primary text-stitch-primary font-mono text-[10px] tracking-widest uppercase hover:bg-stitch-primary hover:text-stitch-on-primary transition-colors"
                  >
                    Generate Now
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Attendees Table for Active Session */}
      {activeSession && (
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <h2 className="text-xs font-mono font-bold tracking-[0.2em] text-stitch-on-surface uppercase">
              Check-ins ({attendees.length})
            </h2>
            <span className="text-[10px] font-mono text-stitch-secondary uppercase tracking-widest">
              Session: {activeSession.title || 'Main Session'}
            </span>
          </div>

          <div className="overflow-x-auto border border-stitch-outline-variant bg-stitch-surface-container-lowest">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-stitch-outline-variant bg-stitch-surface">
                  <th className="px-4 py-3 text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-stitch-secondary">User</th>
                  <th className="px-4 py-3 text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-stitch-secondary">Status</th>
                  <th className="px-4 py-3 text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-stitch-secondary">Method</th>
                  <th className="px-4 py-3 text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-stitch-secondary">Time</th>
                </tr>
              </thead>
              <tbody>
                {isLoadingAttendance ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-12 text-center text-stitch-secondary text-sm font-mono uppercase tracking-widest">
                      Loading...
                    </td>
                  </tr>
                ) : attendees.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-12 text-center text-stitch-secondary text-sm font-mono uppercase tracking-widest">
                      No check-ins yet for this session.
                    </td>
                  </tr>
                ) : (
                  attendees.map((record) => (
                    <tr key={record.id} className="border-b border-stitch-outline-variant last:border-b-0 hover:bg-stitch-surface transition-colors">
                      <td className="px-4 py-4">
                        <div className="text-sm font-semibold text-stitch-on-surface">
                          {record.user?.fullName || 'Unknown User'}
                        </div>
                        <div className="text-xs text-stitch-secondary font-mono">
                          {record.user?.email}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className={clsx(
                          "text-[10px] font-mono font-bold tracking-widest uppercase px-2 py-0.5 border flex items-center gap-1 w-fit",
                          record.status === 'PRESENT' ? "border-green-600 text-green-600 bg-green-50 dark:bg-green-900/10 dark:text-green-400 dark:border-green-400" :
                          record.status === 'EXCUSED' ? "border-blue-600 text-blue-600 bg-blue-50 dark:bg-blue-900/10 dark:text-blue-400 dark:border-blue-400" :
                          "border-red-600 text-red-600 bg-red-50 dark:bg-red-900/10 dark:text-red-400 dark:border-red-400"
                        )}>
                          {record.status === 'PRESENT' ? <CheckCircle className="w-3 h-3" /> : record.status === 'EXCUSED' ? <Check className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                          {record.status}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <span className="text-[10px] font-mono tracking-widest uppercase text-stitch-secondary border border-stitch-outline-variant px-2 py-0.5 bg-stitch-surface">
                          {record.method}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-xs font-mono text-stitch-on-surface-variant tabular-nums">
                        {formatTime(record.markedAt)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {hasNextAttendancePage && (
            <div className="flex justify-center pt-3">
              <button
                onClick={() => fetchNextAttendancePage()}
                disabled={isFetchingNextAttendancePage}
                className="px-6 py-2 border border-stitch-outline-variant text-stitch-secondary font-mono text-xs uppercase tracking-widest hover:text-stitch-on-surface hover:bg-stitch-surface transition-colors disabled:opacity-50"
              >
                {isFetchingNextAttendancePage ? 'Loading more...' : 'Load More'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Attendance Disputes Section */}
      {auth.canManageAttendance && (
        <div className="space-y-3 mt-8">
          <h2 className="text-xs font-mono font-bold tracking-[0.2em] text-stitch-on-surface uppercase">
            Attendance Disputes ({disputes.length})
          </h2>

          <div className="overflow-x-auto border border-stitch-outline-variant bg-stitch-surface-container-lowest">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-stitch-outline-variant bg-stitch-surface">
                  <th className="px-4 py-3 text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-stitch-secondary">Student</th>
                  <th className="px-4 py-3 text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-stitch-secondary">Session</th>
                  <th className="px-4 py-3 text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-stitch-secondary">Status</th>
                  <th className="px-4 py-3 text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-stitch-secondary">Reason</th>
                  <th className="px-4 py-3 text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-stitch-secondary">Submitted</th>
                  <th className="px-4 py-3 text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-stitch-secondary text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoadingDisputes ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-stitch-secondary text-sm font-mono uppercase tracking-widest">
                      Loading disputes...
                    </td>
                  </tr>
                ) : disputes.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-stitch-secondary text-sm font-mono uppercase tracking-widest">
                      No attendance disputes.
                    </td>
                  </tr>
                ) : (
                  disputes.map((dispute) => (
                    <tr key={dispute.id} className="border-b border-stitch-outline-variant last:border-b-0 hover:bg-stitch-surface transition-colors">
                      <td className="px-4 py-4">
                        <div className="text-sm font-semibold text-stitch-on-surface">
                          {dispute.user?.fullName || 'Unknown'}
                        </div>
                        <div className="text-xs text-stitch-secondary font-mono">
                          ID: {dispute.userId}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-xs font-mono text-stitch-secondary">
                        {dispute.sessionId.split('-')[0]}
                      </td>
                      <td className="px-4 py-4">
                        <span className={clsx(
                          "text-[10px] font-mono font-bold tracking-widest uppercase px-2 py-0.5 border flex items-center gap-1 w-fit",
                          dispute.status === 'APPROVED' ? "border-green-600 text-green-600 bg-green-50 dark:bg-green-900/10 dark:text-green-400 dark:border-green-400" :
                          dispute.status === 'REJECTED' ? "border-red-600 text-red-600 bg-red-50 dark:bg-red-900/10 dark:text-red-400 dark:border-red-400" :
                          "border-blue-600 text-blue-600 bg-blue-50 dark:bg-blue-900/10 dark:text-blue-400 dark:border-blue-400"
                        )}>
                          {dispute.status}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-xs font-mono text-stitch-on-surface-variant max-w-[200px] truncate" title={dispute.reason}>
                        {dispute.reason}
                      </td>
                      <td className="px-4 py-4 text-xs font-mono text-stitch-on-surface-variant tabular-nums">
                        {new Date(dispute.submittedAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-4 text-right">
                        {dispute.status === 'PENDING' ? (
                          <button
                            onClick={() => {
                              setSelectedDispute(dispute);
                              setResolveModalOpen(true);
                            }}
                            className="px-3 py-1 bg-stitch-primary text-stitch-on-primary font-mono text-[10px] uppercase tracking-widest hover:opacity-80 transition-opacity"
                          >
                            Review
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              alert(`Reason: ${dispute.reason}\nNotes: ${dispute.reviewNotes || 'None'}`);
                            }}
                            className="px-3 py-1 border border-stitch-outline-variant text-stitch-secondary font-mono text-[10px] uppercase tracking-widest hover:bg-stitch-surface transition-colors"
                          >
                            Details
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* RESOLVE DISPUTE MODAL */}
      <Modal
        isOpen={resolveModalOpen}
        onClose={() => setResolveModalOpen(false)}
        title="Resolve Attendance Dispute"
      >
        <div className="p-6">
          <form onSubmit={handleResolveSubmit} className="space-y-6">
            <div>
              <label className="block text-[10px] font-mono font-bold uppercase tracking-widest text-stitch-secondary mb-1">
                Student Reason
              </label>
              <div className="p-3 bg-stitch-surface border border-stitch-outline-variant text-sm font-mono text-stitch-on-surface">
                {selectedDispute?.reason || 'No reason provided.'}
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-mono font-bold uppercase tracking-widest text-stitch-secondary mb-1">
                Decision <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={resolveStatus}
                onChange={(e) => setResolveStatus(e.target.value as 'APPROVED' | 'REJECTED')}
                className="w-full bg-stitch-surface border border-stitch-outline-variant px-3 py-2 text-sm font-mono text-stitch-on-surface focus:outline-none focus:border-stitch-primary"
              >
                <option value="APPROVED">Approve (Mark Excused)</option>
                <option value="REJECTED">Reject</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-mono font-bold uppercase tracking-widest text-stitch-secondary mb-1">
                Review Notes (Optional)
              </label>
              <textarea
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                placeholder="Provide a reason for the decision..."
                className="w-full h-24 bg-stitch-surface border border-stitch-outline-variant px-3 py-2 text-sm font-mono text-stitch-on-surface focus:outline-none focus:border-stitch-primary resize-none"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setResolveModalOpen(false)}
                className="px-4 py-2 border border-stitch-outline-variant text-stitch-secondary font-mono text-xs uppercase tracking-widest hover:bg-stitch-surface hover:text-stitch-on-surface transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={resolveMutation.isPending}
                className="px-5 py-2 bg-stitch-primary text-stitch-on-primary font-mono text-xs uppercase tracking-widest font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {resolveMutation.isPending ? 'Submitting...' : 'Submit Decision'}
              </button>
            </div>
          </form>
        </div>
      </Modal>

      {/* MANUAL ATTENDANCE MARKING MODAL */}
      <Modal
        isOpen={isManualModalOpen}
        onClose={() => {
          setIsManualModalOpen(false);
          setSelectedUserId(null);
          setManualMarkStatus(null);
        }}
        title="Mark Attendance Manually"
      >
        <div className="p-6 space-y-4">
          <p className="text-xs font-mono text-stitch-secondary uppercase tracking-widest">
            Select a REGISTERED student for {event?.title} to manually mark PRESENT for session: <strong className="text-stitch-on-surface">{activeSession?.title || 'Main Session'}</strong>.
          </p>

          {manualMarkStatus && (
            <div className={clsx(
              "p-3 border text-xs font-mono flex items-center gap-2",
              manualMarkStatus.type === 'success' ? "border-green-600/40 bg-green-500/10 text-green-700 dark:text-green-400" : "border-red-600/40 bg-red-500/10 text-red-700 dark:text-red-400"
            )}>
              {manualMarkStatus.type === 'success' ? <CheckCircle className="w-4 h-4 flex-shrink-0" /> : <AlertTriangle className="w-4 h-4 flex-shrink-0" />}
              <span>{manualMarkStatus.message}</span>
            </div>
          )}

          {/* Student Search Input */}
          <div className="relative">
            <Search className="w-4 h-4 text-stitch-secondary absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search registered student by name or email..."
              className="w-full bg-stitch-surface border border-stitch-outline-variant pl-9 pr-3 py-2 text-xs font-mono text-stitch-on-surface focus:outline-none focus:border-stitch-primary"
            />
          </div>

          {/* Registered Student Roster List */}
          <div className="max-h-60 overflow-y-auto border border-stitch-outline-variant divide-y divide-stitch-outline-variant bg-stitch-surface-container-lowest">
            {isLoadingRegistrations ? (
              <div className="p-6 text-center text-xs font-mono text-stitch-secondary uppercase tracking-widest">
                Loading registrants...
              </div>
            ) : registeredStudents.length === 0 ? (
              <div className="p-6 text-center text-xs font-mono text-stitch-secondary uppercase tracking-widest">
                {searchQuery ? 'No matching registered students found.' : 'No registered students found for this event.'}
              </div>
            ) : (
              registeredStudents.map((reg) => {
                const isSelected = selectedUserId === reg.user.id;
                return (
                  <button
                    key={reg.id}
                    type="button"
                    onClick={() => setSelectedUserId(reg.user.id)}
                    className={clsx(
                      "w-full px-4 py-3 text-left flex items-center justify-between transition-colors",
                      isSelected
                        ? "bg-stitch-primary/10 border-l-4 border-l-stitch-primary"
                        : "hover:bg-stitch-surface"
                    )}
                  >
                    <div>
                      <div className="text-xs font-semibold text-stitch-on-surface">
                        {reg.user.fullName || 'Unknown User'}
                      </div>
                      <div className="text-[10px] font-mono text-stitch-secondary">
                        {reg.user.email}
                      </div>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-stitch-primary" />}
                  </button>
                );
              })
            )}
          </div>

          {/* Modal Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                setIsManualModalOpen(false);
                setSelectedUserId(null);
                setManualMarkStatus(null);
              }}
              className="px-4 py-2 border border-stitch-outline-variant text-stitch-secondary font-mono text-xs uppercase tracking-widest hover:bg-stitch-surface hover:text-stitch-on-surface transition-colors"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handleManualMarkSubmit}
              disabled={!selectedUserId || manualAttendance.isPending}
              className="px-5 py-2 bg-stitch-primary text-stitch-on-primary font-mono text-xs uppercase tracking-widest font-bold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2"
            >
              {manualAttendance.isPending ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Marking...
                </>
              ) : (
                'Mark Present'
              )}
            </button>
          </div>
        </div>
      </Modal>

      {/* New Session Creation Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create Attendance Session"
      >
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-[10px] font-mono font-bold uppercase tracking-widest text-stitch-secondary mb-1">
              Session Title
            </label>
            <input
              type="text"
              value={newSessionTitle}
              onChange={(e) => setNewSessionTitle(e.target.value)}
              placeholder="e.g. Session 1, Afternoon Session"
              className="w-full bg-stitch-surface border border-stitch-outline-variant px-3 py-2 text-xs font-mono text-stitch-on-surface focus:outline-none focus:border-stitch-primary"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(false)}
              className="px-4 py-2 border border-stitch-outline-variant text-stitch-secondary font-mono text-xs uppercase tracking-widest hover:bg-stitch-surface hover:text-stitch-on-surface transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleStartSession}
              disabled={createSession.isPending}
              className="px-5 py-2 bg-stitch-primary text-stitch-on-primary font-mono text-xs uppercase tracking-widest font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {createSession.isPending ? 'Creating...' : 'Create & Start'}
            </button>
          </div>
        </div>
      </Modal>

      {/* End Session Confirmation Modal */}
      <Modal 
        isOpen={isEndSessionModalOpen} 
        onClose={() => setIsEndSessionModalOpen(false)}
        title="End Session"
      >
        <div className="p-6">
          <p className="text-xs font-mono text-stitch-secondary uppercase tracking-widest mb-6">
            Are you sure you want to end this attendance session? Active QR codes will immediately expire.
          </p>
          <div className="flex gap-4 justify-end">
            <button
              onClick={() => setIsEndSessionModalOpen(false)}
              className="px-4 py-2 border border-stitch-outline-variant font-mono text-xs uppercase tracking-widest text-stitch-secondary hover:bg-stitch-surface hover:text-stitch-on-surface transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={confirmEndSession}
              disabled={updateSession.isPending}
              className="px-5 py-2 bg-red-600 font-mono text-xs uppercase tracking-widest text-white hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              {updateSession.isPending ? 'Ending...' : 'Yes, End Session'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Fullscreen Modal */}
      {isFullscreen && qrData && (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-8 backdrop-blur-md">
          <div className="absolute top-8 right-8 flex gap-4">
            <button 
              onClick={handleManualGenerate}
              className="px-6 py-3 border border-stitch-outline-variant text-stitch-secondary font-mono text-xs uppercase tracking-widest hover:text-white hover:border-white transition-colors flex items-center gap-2"
            >
              {isGeneratingQr ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Force Refresh
            </button>
            <button 
              onClick={() => setIsFullscreen(false)}
              className="px-6 py-3 border border-white text-white font-mono font-bold text-xs tracking-widest hover:bg-white hover:text-black transition-colors uppercase flex items-center gap-2"
            >
              <XCircle className="w-4 h-4" /> Close
            </button>
          </div>

          <div className="bg-white p-12 rounded-2xl shadow-2xl">
            <QRCodeSVG value={qrData.payload} size={Math.min(window.innerWidth - 100, window.innerHeight - 300, 600)} />
          </div>

          <div className="mt-12 text-center">
            <h2 className="text-3xl font-black text-white uppercase tracking-widest mb-4 font-mono">{event?.title}</h2>
            {isExpired ? (
              <div className="text-red-500 font-mono text-xl uppercase tracking-widest font-bold">QR Expired</div>
            ) : (
              <div className="text-stitch-secondary font-mono text-xl uppercase tracking-widest flex items-center justify-center gap-3">
                {isGeneratingQr && <RefreshCw className="w-5 h-5 animate-spin" />}
                Refreshing in {countdown ?? '-'}s
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
