'use client';

import React, { use, useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, Button, Skeleton, Alert, Typography, Table, Badge, Breadcrumb, Space, Modal, Form, Input, Select, QRCode, Row, Col, InputNumber, App, Tag, Grid, Flex, Empty, DatePicker, Tabs } from 'antd';
import { QrcodeOutlined, DownloadOutlined, PlusOutlined, SyncOutlined, CloseOutlined } from '@ant-design/icons';
import { AttendanceDisputes } from './AttendanceDisputes';
import { useEventDetail } from '../../../../../hooks/useEventDetail';
import { useAttendance, useGenerateQr, useCreateSession, useUpdateSession, useManualAttendance, AttendanceRecord } from '../../../../../hooks/useAttendance';
import { useAdminUsers } from '../../../../../hooks/useUserManagement';
import { useCurrentUser } from '../../../../../hooks/useCurrentUser';
import { getWebAuthStore } from '../../../../../lib/auth-store';
import { resolveEventLockState } from '../../../../../lib/event-utils';
import { canMarkAttendanceManually as checkCanMarkManually } from '../../../../../lib/auth-helpers';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { useBreakpoint } = Grid;

export default function AttendancePage({ params }: { params: Promise<{ id: string }> }) {
  const { message, modal } = App.useApp();
  const router = useRouter();
  const unwrappedParams = use(params);
  const eventId = unwrappedParams.id;
  
  const screens = useBreakpoint();
  const isMobile = !screens.md;

  const { data: event, isLoading: isEventLoading, isError: isEventError } = useEventDetail(eventId);
  const { data: currentUser } = useCurrentUser();
  
  const auth = useMemo(() => {
    if (!currentUser || !event) return { canManageAttendance: false };
    const isGlobal = currentUser.global_role === 'PLATFORM_ADMIN' || currentUser.global_role === 'FACULTY_ADMIN';
    const userAdminClubs = currentUser.club_memberships.filter(m => m.role === 'CLUB_ADMIN' || m.role === 'CORE_MEMBER').map(m => m.club_id);
    const userMentorClubs = currentUser.club_memberships.filter(m => m.role === 'FACULTY_MENTOR').map(m => m.club_id);
    const isClubAdmin = event.eventClubs?.some(ec => userAdminClubs.includes(ec.clubId)) ?? false;
    const isMentor = event.eventClubs?.some(ec => userMentorClubs.includes(ec.clubId)) ?? false;
    return { canManageAttendance: isGlobal || isClubAdmin || isMentor };
  }, [currentUser, event]);

  const sessions = useMemo(() => event?.attendanceSessions || [], [event?.attendanceSessions]);
  
  const canMarkManually = checkCanMarkManually(currentUser, event);
  
  const [activeSessionId, setActiveSessionId] = useState<string | undefined>(undefined);
  
  useEffect(() => {
    if (sessions.length === 1 && !activeSessionId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveSessionId(sessions[0].id);
    }
     
  }, [sessions, activeSessionId]);

  const { 
    data, 
    isLoading, 
    isError, 
    error,
    fetchNextPage, 
    hasNextPage, 
    isFetchingNextPage 
  } = useAttendance(eventId, activeSessionId ?? undefined);

  const [searchQuery, setSearchQuery] = useState('');
  const { data: searchData, isLoading: isSearchLoading } = useAdminUsers(searchQuery);

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [isCapturingLocation, setIsCapturingLocation] = useState(false);
  const [sessionLocation, setSessionLocation] = useState<{ latitude: number; longitude: number; accuracy: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [form] = Form.useForm();
  
  useEffect(() => {
    if (createModalOpen && event && event.startTime && event.endTime) {
      const start = dayjs(event.startTime);
      const end = dayjs(event.endTime);
      form.setFieldsValue({
        title: '',
        start_time: start,
        end_time: end,
        open_at: start.subtract(15, 'minute'),
        close_at: end.add(15, 'minute'),
        geofence_radius: 50
      });
      queueMicrotask(() => {
        setSessionLocation(null);
        setLocationError(null);
        setIsCapturingLocation(true);
      });
      
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            setSessionLocation({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy,
            });
            setIsCapturingLocation(false);
          },
          (error) => {
            console.error('Geolocation error:', error);
            setLocationError(error.message || 'Failed to capture location');
            setIsCapturingLocation(false);
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
      } else {
        queueMicrotask(() => {
          setLocationError('Geolocation is not supported by this browser');
          setIsCapturingLocation(false);
        });
      }
    }
  }, [createModalOpen, event, form]);
  
  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [manualForm] = Form.useForm();
  const manualAttendance = useManualAttendance(eventId);

  // Selected session and QR state
  const [qrData, setQrData] = useState<{ payload: string; expiresAt: string } | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [isExpired, setIsExpired] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [qrSize, setQrSize] = useState(400);
  
  const qrRefreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isRefreshingRef = useRef(false);
  const retryCountRef = useRef(0);
  const doRefreshRef = useRef<((sessionId: string) => void) | null>(null);

  const { mutate: generateQr, isPending: isGeneratingQr } = useGenerateQr();
  const createSession = useCreateSession(eventId);
  const updateSession = useUpdateSession(eventId, activeSessionId || '');

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const activeSession = useMemo(() => sessions.find(s => s.id === activeSessionId), [sessions, activeSessionId]);
  
  const lockState = event ? resolveEventLockState(event) : 'UNLOCKED';
  const isEffectivelyLocked = lockState !== 'UNLOCKED';
  
  const sessionStatus = useMemo(() => {
    if (!activeSession) return undefined;
    const openAt = activeSession.openAt ? new Date(activeSession.openAt as string).getTime() : 0;
    const closeAt = activeSession.closeAt ? new Date(activeSession.closeAt as string).getTime() : null;
    
    if (now < openAt) return 'UPCOMING';
    if (closeAt && now >= closeAt) return 'ENDED';
    return 'ACTIVE';
  }, [activeSession, now]);

  useEffect(() => {
    if (sessionStatus === 'ENDED' || isEffectivelyLocked) {
      if (qrRefreshTimeoutRef.current) clearTimeout(qrRefreshTimeoutRef.current);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (isFullscreen) setIsFullscreen(false);
       
      setQrData(null);
       
      setCountdown(null);
       
      setIsExpired(false);
       
      setRefreshError(null);
      isRefreshingRef.current = false;
      retryCountRef.current = 0;
    }
  }, [sessionStatus, isEffectivelyLocked, isFullscreen]);

  const handleEndSession = () => {
    if (!activeSessionId) return;
    modal.confirm({
      title: 'End attendance session?',
      content: 'Ending this session will stop new attendance scans immediately. Existing attendance records will remain available.',
      okText: 'End Session',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: () => {
        return new Promise<void>((resolve, reject) => {
          updateSession.mutate({ close_at: new Date().toISOString() }, {
            onSuccess: () => {
              message.success('Session ended successfully');
              resolve();
            },
            onError: (err) => {
              message.error(err.message || 'Failed to end session');
              reject(err);
            }
          });
        });
      }
    });
  };

  const handleManualSubmit = async (values: { user_id: string }) => {
    if (!activeSessionId) return;
    try {
      await manualAttendance.mutateAsync({ session_id: activeSessionId, user_id: values.user_id.trim() });
      message.success('Attendance marked manually');
      setManualModalOpen(false);
      manualForm.resetFields();
    } catch (err: unknown) {
      message.error((err as Error).message || 'Failed to mark attendance manually');
    }
  };

  // Resize listener for fullscreen QR size
  useEffect(() => {
    if (!isFullscreen) return;
    const calculateSize = () => {
      const vh = window.innerHeight;
      const vw = window.innerWidth;
      let availableWidth, availableHeight;
      if (vw >= 900) {
        // 2-column layout (QR is on the right)
        availableWidth = (vw / 2) - 80;
        availableHeight = vh - 160;
      } else {
        // Stacked layout
        availableWidth = vw - 80;
        availableHeight = vh - 344;
      }
      setQrSize(Math.floor(Math.max(180, Math.min(440, availableHeight, availableWidth))));
    };
    calculateSize();
    window.addEventListener('resize', calculateSize);
    return () => window.removeEventListener('resize', calculateSize);
  }, [isFullscreen]);

  // Escape key for fullscreen
  useEffect(() => {
    if (!isFullscreen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsFullscreen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  // Minimum refresh interval to avoid backend rate limiting (429)
  const MIN_REFRESH_INTERVAL_MS = process.env.NODE_ENV === 'test' ? 1000 : 30_000;

  const doRefresh = React.useCallback((sessionId: string) => {
    const session = sessions.find(s => s.id === sessionId);
    if (session && session.closeAt && Date.now() >= new Date(session.closeAt).getTime()) {
      return;
    }

    if (isRefreshingRef.current) return;
    isRefreshingRef.current = true;
    
    const scheduleRefresh = (sid: string, delayMs: number) => {
      if (qrRefreshTimeoutRef.current) clearTimeout(qrRefreshTimeoutRef.current);
      qrRefreshTimeoutRef.current = setTimeout(() => {
        isRefreshingRef.current = false;
        if (doRefreshRef.current) doRefreshRef.current(sid);
      }, delayMs);
    };
    
    generateQr(sessionId, {
      onSuccess: (res) => {
        const sessionCheck = sessions.find(s => s.id === sessionId);
        if (sessionCheck && sessionCheck.closeAt && Date.now() >= new Date(sessionCheck.closeAt).getTime()) {
          isRefreshingRef.current = false;
          return;
        }
        if (res.qr_payload && res.expires_at && Number.isFinite(new Date(res.expires_at).getTime())) {
          // Override expiresAt to enforce minimum refresh interval for the countdown display
          const backendExpiresMs = new Date(res.expires_at).getTime();
          const minExpiresMs = Date.now() + MIN_REFRESH_INTERVAL_MS;
          const effectiveExpiresMs = Math.max(backendExpiresMs, minExpiresMs);
          const effectiveExpiresAt = new Date(effectiveExpiresMs).toISOString();

          setQrData({ payload: res.qr_payload, expiresAt: effectiveExpiresAt });
          setRefreshError(null);
          setIsExpired(false);
          retryCountRef.current = 0;
          // Schedule refresh 2s before effective expiry
          scheduleRefresh(sessionId, Math.max(500, effectiveExpiresMs - Date.now() - 2000));
        } else {
           setRefreshError('Invalid QR response');
           retryCountRef.current += 1;
           if (retryCountRef.current <= 3) {
             scheduleRefresh(sessionId, 5000);
           } else {
             setIsExpired(true);
           }
        }
        isRefreshingRef.current = false;
      },
      onError: (err: Error & { status?: number }) => {
        const is429 = err && 'status' in err && err.status === 429;

        if (is429) {
          // Rate limited — back off, but cap retries to prevent infinite loop
          retryCountRef.current += 1;
          setRefreshError(null); // Don't show error — existing QR is still visible
          if (retryCountRef.current <= 5) {
            scheduleRefresh(sessionId, 10_000); // 10s backoff for rate limits
          } else {
            setIsExpired(true);
          }
        } else {
          setRefreshError(err.message || 'Failed to generate QR');
          retryCountRef.current += 1;
          if (retryCountRef.current <= 3) {
            scheduleRefresh(sessionId, 5000);
          } else {
            setIsExpired(true);
          }
        }
        isRefreshingRef.current = false;
      }
    });
  }, [generateQr, sessions, MIN_REFRESH_INTERVAL_MS]);

  useEffect(() => {
    doRefreshRef.current = doRefresh;
  }, [doRefresh]);

  const handleManualGenerate = React.useCallback(() => {
    if (!activeSessionId) return;
    if (qrRefreshTimeoutRef.current) clearTimeout(qrRefreshTimeoutRef.current);
    retryCountRef.current = 0;
    setRefreshError(null);
    doRefresh(activeSessionId);
  }, [activeSessionId, doRefresh]);

  // Visual Countdown Effect
  useEffect(() => {
    if (!qrData) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
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

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (qrRefreshTimeoutRef.current) clearTimeout(qrRefreshTimeoutRef.current);
    };
  }, []);

  // Reset QR and exit fullscreen when session changes
  useEffect(() => {
    if (qrRefreshTimeoutRef.current) clearTimeout(qrRefreshTimeoutRef.current);
    if (qrData) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setQrData(null);
       
      setIsFullscreen(false);
       
      setRefreshError(null);
       
      setIsExpired(false);
      retryCountRef.current = 0;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSessionId]);

  // If unauthorized to view attendance, redirect or show error
  if (isError && ((error as Error)?.message?.includes('403') || (error as Error)?.message?.includes('401'))) {
    return (
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>
        <Alert
          title="Access Denied"
          description="You do not have permission to manage attendance for this event."
          type="error"
          showIcon
          action={
            <Button size="small" onClick={() => router.push(`/events/${eventId}`)}>
              Go Back
            </Button>
          }
        />
      </div>
    );
  }

  if (isEventLoading || isLoading) {
    return (
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>
        <Title level={2}>Attendance</Title>
        <Card variant="borderless">
          <Skeleton active paragraph={{ rows: 6 }} />
        </Card>
      </div>
    );
  }

  if (isEventError) {
    return (
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>
        <Alert
          title="Failed to load event details"
          type="error"
          showIcon
          action={<Button size="small" danger onClick={() => window.location.reload()}>Retry</Button>}
        />
      </div>
    );
  }

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
      modal.error({ title: 'Export Failed', content: 'Failed to export attendance data.' });
    });
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleCreateSessionSubmit = (values: any) => {
    if (!sessionLocation) {
      message.error("Location is required to create a geofenced session");
      return;
    }

    const payload = {
      title: values.title,
      start_time: values.start_time.toISOString(),
      end_time: values.end_time.toISOString(),
      open_at: values.open_at.toISOString(),
      close_at: values.close_at.toISOString(),
      geofence_radius: values.geofence_radius || 50,
      venue_latitude: sessionLocation.latitude,
      venue_longitude: sessionLocation.longitude,
      location_accuracy: sessionLocation.accuracy,
    };
    
    if (new Date(payload.start_time) >= new Date(payload.end_time)) {
      message.error("Start time must be before end time");
      return;
    }
    
    if (new Date(payload.open_at) >= new Date(payload.close_at)) {
      message.error("Open at must be before close at");
      return;
    }

    createSession.mutate(payload, {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      onSuccess: (res: any) => {
        message.success('Session created successfully');
        setCreateModalOpen(false);
        form.resetFields();
        const newId = res?.data?.id || res?.id;
        if (newId) {
          setActiveSessionId(newId);
        }
      },
      onError: (err) => {
        message.error(err.message || 'Failed to create session');
      }
    });
  };

  const records = data?.pages.flatMap(page => page.data) || [];

  const columns = [
    {
      title: 'Participant',
      key: 'participant',
      render: (_: unknown, record: AttendanceRecord) => <Text strong>{record.user?.fullName || record.userId}</Text>,
    },
    {
      title: 'Marked At',
      key: 'markedAt',
      render: (_: unknown, record: AttendanceRecord) => {
        const date = new Date(record.markedAt);
        return <Text>{date.toLocaleDateString()} {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>;
      },
    },
    {
      title: 'Method',
      dataIndex: 'method',
      key: 'method',
      render: (method: string) => <Text type="secondary">{method}</Text>
    },
    {
      title: 'Status',
      key: 'status',
      render: (_: unknown, record: AttendanceRecord) => {
        let status: 'success' | 'warning' | 'error' | 'default' = 'default';
        if (record.status === 'PRESENT') status = 'success';
        if (record.status === 'ABSENT') status = 'error';
        if (record.status === 'EXCUSED') status = 'warning';
        return <Badge status={status} text={record.status} />;
      },
    },
  ];

  const canCreateSession = auth.canManageAttendance && !isEffectivelyLocked && (
    event?.attendanceType === 'MULTI_SESSION' || sessions.length === 0
  );
  
  const isGenerateDisabled = !activeSessionId || isGeneratingQr;

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <Breadcrumb
        items={[
          { title: <Link href="/events">Events</Link> },
          { title: <Link href={`/events/${eventId}`}>{event?.title || 'Event'}</Link> },
          { title: 'Attendance' },
        ]}
      />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <Space align="center" wrap>
          <Title level={2} style={{ margin: 0 }}>Attendance</Title>
          {isEffectivelyLocked && (
            <Tag color="red" variant="filled" style={{ fontSize: 14, padding: '4px 8px' }}>LOCKED — READ-ONLY</Tag>
          )}
        </Space>
        
        <Space>
          {!isEffectivelyLocked && activeSessionId && canMarkManually && sessionStatus === 'ACTIVE' && (
            <Button 
              type="primary" 
              onClick={() => setManualModalOpen(true)}
            >
              Mark Manually
            </Button>
          )}
          <Button icon={<DownloadOutlined />} onClick={handleExport}>
            Export CSV
          </Button>
        </Space>
      </div>
      
      <Text type="secondary" style={{ display: 'block', marginTop: -8 }}>
        Manage sessions, QR attendance, and attendance records.
      </Text>

      <Tabs 
        defaultActiveKey="records" 
        items={[
          {
            key: 'records',
            label: 'Session Records',
            children: (
              <Row gutter={[24, 24]}>
        <Col xs={24} lg={8}>
          <Space orientation="vertical" style={{ width: '100%' }} size="middle">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {sessions.length === 0 ? (
                <Card variant="borderless" styles={{ body: { padding: 16 } }}>
                  <Text strong style={{ display: 'block', marginBottom: 8 }}>No attendance sessions yet.</Text>
                  {canCreateSession && <Button type="primary" onClick={() => setCreateModalOpen(true)} icon={<PlusOutlined />}>Create Session</Button>}
                </Card>
              ) : (
                <>
                  <div style={{ display: 'flex', gap: 8, width: '100%' }}>
                    {!isEffectivelyLocked && sessionStatus !== 'ENDED' && sessionStatus !== 'UPCOMING' && (
                      <Button 
                        type="primary"
                        icon={<QrcodeOutlined />} 
                        onClick={handleManualGenerate}
                        loading={isGeneratingQr && !qrData}
                        disabled={isGenerateDisabled}
                        style={{ flex: 1 }}
                      >
                        Generate QR
                      </Button>
                    )}
                    {!isEffectivelyLocked && sessionStatus === 'ACTIVE' && auth.canManageAttendance && (
                      <Button
                        danger
                        onClick={handleEndSession}
                        loading={updateSession.isPending}
                        disabled={!activeSessionId || isGeneratingQr}
                      >
                        End Session
                      </Button>
                    )}
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <Text type="secondary" style={{ display: 'block' }}>Selected Session:</Text>
                      {canCreateSession && (
                        <Button type="link" size="small" onClick={() => setCreateModalOpen(true)} icon={<PlusOutlined />} style={{ padding: 0 }}>
                          New Session
                        </Button>
                      )}
                    </div>
                    <Select
                      style={{ width: '100%' }}
                      placeholder="Select an attendance session"
                      value={activeSessionId}
                      onChange={setActiveSessionId}
                      options={sessions.map(s => ({ label: s.title || 'Untitled Session', value: s.id, session: s }))}
                      optionRender={(option) => {
                        const s = option.data.session as typeof sessions[0];
                        const open = s.openAt ? new Date(s.openAt as string).getTime() : 0;
                        const close = s.closeAt ? new Date(s.closeAt as string).getTime() : null;
                        let statusText = 'ACTIVE';
                        let color: 'success' | 'processing' | 'error' | 'default' | 'warning' = 'success';
                        if (now < open) { statusText = 'UPCOMING'; color = 'processing'; }
                        else if (close && now >= close) { statusText = 'ENDED'; color = 'error'; }
                        return (
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <Text strong>{s.title}</Text>
                              <div style={{ fontSize: 12, color: 'gray' }}>
                                {s.startTime ? new Date(s.startTime as string).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''} – {s.endTime ? new Date(s.endTime as string).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                              </div>
                            </div>
                            <Badge status={color} text={statusText} />
                          </div>
                        );
                      }}
                    />
                  </div>
                </>
              )}

              {sessionStatus === 'ENDED' ? (
                <Card variant="borderless" styles={{ body: { padding: 24, textAlign: 'center' } }}>
                  <Title level={5} type="danger" style={{ margin: 0, marginBottom: 8 }}>SESSION ENDED</Title>
                  <Text type="secondary">Attendance is no longer being accepted for this session.</Text>
                </Card>
              ) : qrData ? (
                <div 
                  style={{ 
                    padding: 24, 
                    border: '1px solid var(--ant-color-border-secondary)', 
                    borderRadius: 8, 
                    background: 'var(--ant-color-bg-container)', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    alignItems: 'center',
                    cursor: 'pointer',
                    transition: 'border-color 0.2s',
                  }}
                  onClick={() => setIsFullscreen(true)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setIsFullscreen(true); }}
                  aria-label={`Attendance QR for ${sessions.find(s => s.id === activeSessionId)?.title}. Open presentation mode.`}
                  className="qr-presentation-trigger"
                >
                  <QRCode 
                    value={qrData.payload} 
                    size={280} 
                    color="#000000" 
                    bgColor="#FFFFFF"
                    style={{ width: '100%', height: 'auto', maxWidth: 280 }} 
                  />
                  <Space orientation="vertical" style={{ marginTop: 16, textAlign: 'center', width: '100%' }}>
                    <Text type="secondary" strong><QrcodeOutlined /> Click to present</Text>
                    
                    {isExpired ? (
                      <Alert type="error" title="QR expired. Generate a new QR." showIcon style={{ marginTop: 8 }} />
                    ) : refreshError ? (
                      <Text type="danger" style={{ display: 'block', marginTop: 8 }}>QR refresh failed. Retrying...</Text>
                    ) : (
                      <Space style={{ marginTop: 8 }}>
                        {isGeneratingQr && <SyncOutlined spin />}
                        <Text type="secondary">Refreshing in {countdown ?? '-'}s</Text>
                      </Space>
                    )}
                  </Space>
                </div>
              ) : activeSessionId && (
                <Card variant="borderless" styles={{ body: { padding: 16 } }}>
                  <Text strong style={{ display: 'block' }}>No QR generated</Text>
                  <Text type="secondary">Generate a live attendance QR for the selected session.</Text>
                </Card>
              )}
            </div>
          </Space>
        </Col>

        <Col xs={24} lg={16}>
          <Card variant="borderless" styles={{ body: { padding: isMobile ? 12 : 0 } }}>
            {isMobile ? (
              isLoading ? (
                <Flex vertical gap="middle">
                  {[1, 2, 3].map(i => <Card key={i} loading />)}
                </Flex>
              ) : records.length === 0 ? (
                <Empty description="No attendance records yet." />
              ) : (
                <Flex vertical gap="middle">
                  {records.map(record => (
                    <Card key={record.id} style={{ width: '100%' }} styles={{ body: { padding: 16 } }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <Text strong>{record.user?.fullName || record.userId}</Text>
                        <Badge 
                          status={record.status === 'PRESENT' ? 'success' : record.status === 'ABSENT' ? 'error' : record.status === 'EXCUSED' ? 'warning' : 'default'} 
                          text={record.status} 
                        />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
                        <Text type="secondary" style={{ fontSize: 13 }}>
                          {new Date(record.markedAt).toLocaleString(undefined, {
                            month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
                          })}
                        </Text>
                        <Text type="secondary" style={{ fontSize: 13 }}>Method: {record.method}</Text>
                      </div>
                    </Card>
                  ))}
                </Flex>
              )
            ) : (
              <Table
                dataSource={records}
                columns={columns}
                rowKey="id"
                pagination={false}
                size="small"
                loading={isLoading}
                locale={{ emptyText: 'No attendance records yet.' }}
              />
            )}
            
            {hasNextPage && (
              <div style={{ padding: 16, textAlign: 'center' }}>
                <Button onClick={() => fetchNextPage()} loading={isFetchingNextPage}>
                  Load More
                </Button>
              </div>
            )}
          </Card>
        </Col>
              </Row>
            )
          },
          {
            key: 'disputes',
            label: 'Disputes',
            children: <AttendanceDisputes eventId={eventId} canManageAttendance={auth.canManageAttendance} />
          }
        ]}
      />

      <Modal
        title="Create Attendance Session"
        open={createModalOpen}
        onOk={() => form.submit()}
        onCancel={() => setCreateModalOpen(false)}
        confirmLoading={createSession.isPending}
      >
        <Form form={form} layout="vertical" onFinish={handleCreateSessionSubmit}>
          <Form.Item name="title" label="Session Title" rules={[{ required: true, message: 'Please enter a title' }]}>
            <Input placeholder="e.g., Morning Session" />
          </Form.Item>
          
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="start_time" label="Start Time" rules={[{ required: true, message: 'Required' }]}>
                <DatePicker showTime format="YYYY-MM-DD HH:mm" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="end_time" label="End Time" rules={[{ required: true, message: 'Required' }]}>
                <DatePicker showTime format="YYYY-MM-DD HH:mm" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="open_at" label="Attendance Open At" rules={[{ required: true, message: 'Required' }]}>
                <DatePicker showTime format="YYYY-MM-DD HH:mm" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="close_at" label="Attendance Close At" rules={[{ required: true, message: 'Required' }]}>
                <DatePicker showTime format="YYYY-MM-DD HH:mm" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="geofence_radius" label="Geofence Radius (meters)" initialValue={50} rules={[{ required: true }]}>
            <InputNumber min={10} max={1000} style={{ width: '100%' }} />
          </Form.Item>

          <div style={{ marginTop: 16 }}>
            {isCapturingLocation ? (
              <Alert type="info" title="Detecting current location..." showIcon />
            ) : locationError ? (
              <Alert type="error" title="Location required" description={locationError} showIcon />
            ) : sessionLocation ? (
              <Alert 
                type="success" 
                title="Location detected" 
                description={
                  <div style={{ fontSize: 13, marginTop: 4 }}>
                    <Text strong>Latitude:</Text> {sessionLocation.latitude.toFixed(6)} <br/>
                    <Text strong>Longitude:</Text> {sessionLocation.longitude.toFixed(6)} <br/>
                    <Text strong>Accuracy:</Text> {Math.round(sessionLocation.accuracy)}m
                  </div>
                } 
                showIcon 
              />
            ) : null}
          </div>
        </Form>
      </Modal>

      <Modal
        title="Mark Attendance Manually"
        open={manualModalOpen}
        onOk={() => manualForm.submit()}
        onCancel={() => {
          setManualModalOpen(false);
          manualForm.resetFields();
        }}
        confirmLoading={manualAttendance.isPending}
      >
        <Form form={manualForm} layout="vertical" onFinish={handleManualSubmit}>
          <Form.Item 
            name="user_id" 
            label="User" 
            rules={[{ required: true, message: 'Please select a student' }]}
            extra="Search for a student by name or email."
          >
            <Select 
              showSearch 
              placeholder="Search by name or email..." 
              onSearch={setSearchQuery}
              filterOption={false}
              loading={isSearchLoading}
              options={searchData?.pages.flatMap(p => p.data).map(u => ({ 
                label: `${u.fullName || 'Unknown'} (${u.email})`, 
                value: u.id 
              })) || []}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* Fullscreen QR Presentation Overlay */}
      {isFullscreen && qrData && (
        <div 
          role="dialog" 
          aria-modal="true"
          onClick={() => setIsFullscreen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: '#020617',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 'clamp(16px, 3vh, 32px)',
            padding: '24px',
            animation: 'qrFadeIn 0.35s ease-out'
          }}
        >
          <style>{`
            @keyframes qrFadeIn { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
            @keyframes qrGlow { 
              0%, 100% { box-shadow: 0 0 30px rgba(56, 189, 248, 0.12); }
              50% { box-shadow: 0 0 50px rgba(56, 189, 248, 0.2); }
            }
            @keyframes liveDot { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
            .qr-pres-container {
              display: flex;
              flex-direction: column;
              align-items: center;
              text-align: center;
              gap: 40px;
              width: 100%;
              max-width: 1200px;
              position: relative;
              z-index: 1;
            }
            .qr-pres-info {
              display: flex;
              flex-direction: column;
              align-items: center;
              gap: 24px;
            }
            .qr-pres-badge {
              display: inline-block; padding: 4px 14px; background: rgba(56, 189, 248, 0.1); border-radius: 20px; font-size: 11px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.2);
            }
            @media (min-width: 900px) {
              .qr-pres-container {
                flex-direction: row;
                justify-content: space-between;
                text-align: left;
                padding: 0 48px;
                gap: 80px;
              }
              .qr-pres-info {
                align-items: flex-start;
              }
            }
          `}</style>
          
          <Button 
            type="text" 
            icon={<CloseOutlined style={{ fontSize: 24, color: '#fff' }} />} 
            onClick={(e) => { e.stopPropagation(); setIsFullscreen(false); }}
            style={{ position: 'absolute', top: 24, right: 24, zIndex: 2, background: 'rgba(255,255,255,0.1)' }}
            aria-label="Close presentation mode"
          />

          <div className="qr-pres-container" onClick={e => e.stopPropagation()}>
            <div className="qr-pres-info" style={{ flex: 1 }}>
              <div>
                <div className="qr-pres-badge" style={{ marginBottom: 16 }}>
                  <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#38bdf8', marginRight: 8, animation: 'liveDot 2s infinite' }}></span>
                  Live Scan
                </div>
                <h1 style={{ color: '#fff', fontSize: 'clamp(32px, 5vw, 48px)', margin: '0 0 16px 0', lineHeight: 1.1, fontWeight: 600 }}>
                  {sessions.find(s => s.id === activeSessionId)?.title}
                </h1>
                <p style={{ color: '#94a3b8', fontSize: 'clamp(18px, 2.5vw, 24px)', margin: 0, maxWidth: 500 }}>
                  {event?.title}
                </p>
              </div>

              <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '24px', borderRadius: 16, border: '1px solid rgba(255, 255, 255, 0.05)', width: '100%', maxWidth: 400 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <span style={{ color: '#64748b', fontSize: 14, textTransform: 'uppercase', letterSpacing: 1 }}>Status</span>
                  {isExpired ? (
                    <span style={{ color: '#ef4444', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}><CloseOutlined /> Expired</span>
                  ) : refreshError ? (
                    <span style={{ color: '#f59e0b', fontWeight: 600 }}>Error Retrying</span>
                  ) : (
                    <span style={{ color: '#38bdf8', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}><SyncOutlined spin={isGeneratingQr} /> Active</span>
                  )}
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#64748b', fontSize: 14, textTransform: 'uppercase', letterSpacing: 1 }}>Next Refresh</span>
                  <span style={{ color: '#f8fafc', fontSize: 24, fontVariantNumeric: 'tabular-nums', fontWeight: 300 }}>
                    {isExpired ? '---' : countdown !== null ? `00:${countdown.toString().padStart(2, '0')}` : '...'}
                  </span>
                </div>
              </div>
            </div>

            <div 
              style={{
                background: '#fff', 
                padding: 'clamp(16px, 3vw, 32px)', 
                borderRadius: 'clamp(16px, 2vw, 24px)', 
                animation: 'qrGlow 4s infinite ease-in-out',
                position: 'relative'
              }}
            >
              <QRCode 
                value={qrData.payload} 
                size={qrSize}
                color="#0f172a" 
                bgColor="#FFFFFF"
                style={{ display: 'block', transition: 'opacity 0.2s', opacity: isExpired ? 0.3 : 1 }} 
              />
              {isExpired && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
                  <div style={{ background: '#ef4444', color: '#fff', padding: '8px 16px', borderRadius: 8, fontWeight: 600 }}>QR Expired</div>
                  <Button type="primary" onClick={() => handleManualGenerate()}>Regenerate</Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
