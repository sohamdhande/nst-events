'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEventDetail, useMyRegistration } from '../../../../../hooks/useEventDetail';
import { useRegisterForEvent, useCancelRegistration } from '../../../../../hooks/useRegisterForEvent';
import { useTeamLookup } from '../../../../../hooks/useTeams';
import { ArrowLeft, Clock, MapPin, Users, Info, Calendar } from 'lucide-react';
import { Modal } from '../../../../../components/ui/Modal';
import { TeamGatewayModal } from './components/TeamGatewayModal';
import { AttendanceDisputeModal } from './components/AttendanceDisputeModal';
import { useAttendanceDisputes, useMyAttendance } from '../../../../../hooks/useAttendance';
import { useCurrentUser } from '../../../../../hooks/useCurrentUser';
import { useEventLifecycle } from '../../../../../hooks/useEventLifecycle';
import { useClubAdmin } from '../../../../../components/layout/ClubAdminProvider';

const dateFormatter = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
const timeFormatter = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

export default function StudentEventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: eventId } = use(params);
  const router = useRouter();
  const { setClubAdminMode, setActiveClubId } = useClubAdmin();

  const { data: event, isLoading: isLoadingEvent, isError: isErrorEvent } = useEventDetail(eventId);
  const { data: registration, isLoading: isLoadingReg } = useMyRegistration(eventId);

  const { mutate: register, isPending: isRegistering } = useRegisterForEvent(eventId);
  const { mutate: cancel, isPending: isCanceling } = useCancelRegistration(eventId);

  // If user is in a team for this event, fetch the team details
  const { data: team, isLoading: isLoadingTeam, isError: isErrorTeam } = useTeamLookup(registration?.team_id);

  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [isTeamGatewayOpen, setIsTeamGatewayOpen] = useState(false);
  const [disputeSessionId, setDisputeSessionId] = useState<string | null>(null);

  const { data: disputesData, isLoading: isLoadingDisputes } = useAttendanceDisputes(eventId);
  const { data: myAttendanceData, isLoading: isLoadingAttendance } = useMyAttendance(eventId);
  const myAttendanceRecords = myAttendanceData?.pages.flatMap(p => p.data) || [];

  const { data: currentUser } = useCurrentUser();
  const { submitMutation } = useEventLifecycle();



  const isClubAdminForEvent = event?.eventClubs?.some((ec: any) => 
    ec.isPrimary && currentUser?.club_memberships?.some(m => m.club_id === ec.club.id && m.role === 'CLUB_ADMIN')
  );

  // Grouped Loading state
  if (isLoadingEvent || isLoadingReg) {
    return (
      <div className="w-full flex-grow flex justify-center items-center h-64">
        <div className="animate-pulse flex flex-col items-center">
          <div className="h-8 w-8 border-4 border-stitch-on-surface border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-sm font-medium text-stitch-secondary uppercase tracking-widest font-mono">Loading Event...</p>
        </div>
      </div>
    );
  }

  if (isErrorEvent || !event) {
    return (
      <div className="w-full flex-grow text-center py-20">
        <p className="text-stitch-secondary mb-4">This event could not be loaded.</p>
        <button onClick={() => router.back()} className="text-stitch-on-surface font-medium hover:underline font-mono uppercase text-sm tracking-widest">
          Go Back
        </button>
      </div>
    );
  }

  const primaryClub = event.eventClubs?.find((c) => c.isPrimary)?.club;
  const dbNow = new Date();
  const isPermanentLock = new Date(event.endTime).getTime() + 24 * 60 * 60 * 1000 <= dbNow.getTime();
  const isLocked = event.lock_state !== 'UNLOCKED' || isPermanentLock;
  const isEnded = new Date(event.endTime) <= dbNow;
  
  const disputeWindowEnd = new Date(event.endTime).getTime() + 24 * 60 * 60 * 1000;
  const isDisputeWindowOpen = isEnded && dbNow.getTime() <= disputeWindowEnd;
  const existingDispute = disputesData?.pages?.[0]?.data?.[0];
  const primarySessionId = event.attendanceSessions?.[0]?.id;

  const registrationCount = (event as any).registrationCount ?? (event as any).registration_count;
  const isCapacityFull = event.maxCapacity !== null && typeof registrationCount === 'number' && registrationCount >= event.maxCapacity;

  const handleRegisterConfirm = () => {
    register(undefined, {
      onSuccess: () => {
        setIsRegisterModalOpen(false);
      }
    });
  };

  const handleCancelConfirm = () => {
    cancel(undefined, {
      onSuccess: () => {
        setIsCancelModalOpen(false);
      }
    });
  };

  const renderRegistrationAction = () => {
    if (isEnded) {
      return (
        <div className="w-full text-center px-4 py-3 bg-stitch-surface-variant text-stitch-secondary font-mono font-bold text-xs tracking-widest uppercase border border-stitch-outline-variant">
          Event Ended
        </div>
      );
    }

    if (isLocked) {
      return (
        <div className="w-full text-center px-4 py-3 bg-stitch-surface-variant text-stitch-secondary font-mono font-bold text-xs tracking-widest uppercase border border-stitch-outline-variant">
          Registration Locked
        </div>
      );
    }

    // Unregistered State for Team Event
    if (event.registrationType === 'TEAM' && (!registration || (!registration.team_id && registration.status !== 'REGISTERED' && registration.status !== 'WAITLISTED'))) {
      return (
        <div className="space-y-3">
          <p className="text-sm text-stitch-on-surface-variant">You need a team to participate in this event.</p>
          <button 
            onClick={() => setIsTeamGatewayOpen(true)}
            className="w-full flex items-center justify-center px-6 py-3.5 bg-stitch-primary text-stitch-on-primary font-mono font-bold text-xs tracking-widest hover:bg-stitch-surface-tint transition-colors uppercase"
          >
            Register / Join Team
          </button>
        </div>
      );
    }

    // Unregistered State for Individual Event
    if (!registration || registration.status === 'NOT_REGISTERED') {
      return (
        <button
          onClick={() => setIsRegisterModalOpen(true)}
          className="w-full flex items-center justify-center px-6 py-3.5 bg-stitch-primary text-stitch-on-primary font-mono font-bold text-xs tracking-widest hover:bg-stitch-surface-tint transition-colors uppercase"
        >
          {isCapacityFull ? 'Join Waitlist' : 'Register'}
        </button>
      );
    }

    return null;
  };

  const renderCancellation = () => {
    if (isEnded || isLocked || !registration || registration.status === 'NOT_REGISTERED' || registration.status === 'CANCELLED') return null;
    
    // Team cancellation happens via Team Hub
    if (event.registrationType === 'TEAM') return null;

    return (
      <button 
        onClick={() => setIsCancelModalOpen(true)}
        className="text-xs font-mono font-bold uppercase tracking-widest text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 underline underline-offset-4 mt-4 inline-block"
      >
        Cancel Registration
      </button>
    );
  };

  const formatModalDate = (dateString: string) => {
    return new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date(dateString));
  };

  const formatModalTime = (dateString: string) => {
    return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(dateString));
  };

  const renderDisputeSection = () => {
    // Only relevant if student is registered, and there are sessions
    if (registration?.status !== 'REGISTERED' || !event.attendanceSessions?.length) return null;

    if (isLoadingDisputes || isLoadingAttendance) {
      return (
        <div className="mt-4 p-4 border border-stitch-outline-variant bg-stitch-surface flex items-center justify-center">
          <div className="w-4 h-4 border-2 border-stitch-on-surface border-t-transparent rounded-full animate-spin"></div>
        </div>
      );
    }

    return (
      <div className="mt-4">
        <h3 className="text-xs font-mono font-bold tracking-[0.2em] text-stitch-secondary uppercase border-b border-stitch-outline-variant pb-1.5 mb-3">Attendance</h3>
        <div className="space-y-3">
          {event.attendanceSessions.map((session: any) => {
            // Find the attendance record for this specific session
            const attendanceRecord = myAttendanceRecords.find(r => r.sessionId === session.id);
            // Find any dispute for this specific session
            const sessionDispute = disputesData?.pages?.flatMap(p => p.data)?.find(d => d.sessionId === session.id);
            
            // Check if dispute window is open for this specific session
            // The dispute window ends 24 hours after the event ends (per existing logic)
            const disputeWindowEnd = new Date(event.endTime).getTime() + 24 * 60 * 60 * 1000;
            const isWindowOpen = new Date().getTime() <= disputeWindowEnd;

            return (
              <div key={session.id} className="p-3 border border-stitch-outline-variant bg-stitch-surface flex justify-between items-start gap-4">
                <div>
                  <h4 className="text-[10px] font-mono font-bold text-stitch-on-surface uppercase mb-0.5">{session.title}</h4>
                  <p className="text-[10px] text-stitch-secondary font-mono">
                    {formatModalDate(session.startTime)} • {formatModalTime(session.startTime)}
                  </p>
                </div>
                <div className="text-right">
                  {attendanceRecord ? (
                    <div>
                      <div className={`text-[10px] font-mono font-bold tracking-widest uppercase ${attendanceRecord.status === 'PRESENT' ? 'text-green-500' : attendanceRecord.status === 'EXCUSED' ? 'text-blue-500' : 'text-red-500'}`}>
                        {attendanceRecord.status}
                      </div>
                    </div>
                  ) : sessionDispute ? (
                    <div>
                       <div className={`text-[10px] font-mono font-bold tracking-widest uppercase ${
                          sessionDispute.status === 'APPROVED' ? 'text-green-500' : 
                          sessionDispute.status === 'REJECTED' ? 'text-red-500' : 'text-yellow-500'
                       }`}>
                         DISPUTE {sessionDispute.status}
                       </div>
                    </div>
                  ) : (
                    <div>
                      {!isEnded ? (
                        <div className="text-[10px] font-mono font-bold tracking-widest uppercase text-stitch-secondary mb-1">NOT MARKED</div>
                      ) : (
                        <>
                          <div className="text-[10px] font-mono font-bold tracking-widest uppercase text-red-500 mb-1">ABSENT</div>
                          {isWindowOpen ? (
                            <button 
                              onClick={() => setDisputeSessionId(session.id)}
                              className="text-[10px] font-mono font-bold tracking-widest text-stitch-on-surface hover:underline uppercase"
                            >
                              REPORT ISSUE
                            </button>
                          ) : (
                            <div className="text-[9px] font-mono text-stitch-secondary uppercase">Window Closed</div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="w-full flex-grow bg-stitch-surface-container-lowest text-stitch-on-surface font-sans min-h-screen">
      {/* REGISTRATION MODAL */}
      <Modal 
        isOpen={isRegisterModalOpen} 
        onClose={() => !isRegistering && setIsRegisterModalOpen(false)} 
        title={isCapacityFull ? "JOIN WAITLIST" : "CONFIRM REGISTRATION"}
      >
        <div className="p-6 pt-0">
          <h3 className="text-lg font-medium text-stitch-on-surface mb-6">{event.title}</h3>
          
          <div className="flex flex-col border-y border-stitch-outline-variant py-4 mb-8 space-y-4">
            <div>
              <div className="text-xs font-mono text-stitch-secondary uppercase tracking-widest mb-1">Date</div>
              <div className="text-base font-medium text-stitch-on-surface">{formatModalDate(event.startTime)}</div>
            </div>
            <div>
              <div className="text-xs font-mono text-stitch-secondary uppercase tracking-widest mb-1">Time</div>
              <div className="text-base font-medium text-stitch-on-surface">
                {formatModalTime(event.startTime)} — {formatModalTime(event.endTime)}
              </div>
            </div>
            <div>
              <div className="text-xs font-mono text-stitch-secondary uppercase tracking-widest mb-1">Format</div>
              <div className="text-base font-medium text-stitch-on-surface">Individual Registration</div>
            </div>
          </div>

          {isCapacityFull && (
            <p className="text-sm text-stitch-on-surface-variant mb-6">
              This event is currently at capacity. Joining the waitlist does not guarantee entry. You will be automatically registered if a spot opens up.
            </p>
          )}

          <div className="flex flex-col sm:flex-row gap-4">
            <button 
              onClick={() => setIsRegisterModalOpen(false)}
              disabled={isRegistering}
              className="w-full sm:w-auto px-6 py-3 border border-stitch-on-surface text-stitch-on-surface font-mono font-bold text-sm tracking-widest hover:bg-stitch-surface transition-colors uppercase disabled:opacity-50"
            >
              Cancel
            </button>
            <button 
              onClick={handleRegisterConfirm}
              disabled={isRegistering}
              className="w-full sm:flex-1 px-6 py-3 bg-stitch-on-surface text-stitch-surface-container-lowest font-mono font-bold text-sm tracking-widest hover:opacity-80 transition-colors uppercase disabled:opacity-50"
            >
              {isRegistering ? 'Processing...' : isCapacityFull ? 'Join Waitlist' : 'Confirm Registration'}
            </button>
          </div>
        </div>
      </Modal>

      {/* CANCELLATION MODAL */}
      <Modal 
        isOpen={isCancelModalOpen} 
        onClose={() => !isCanceling && setIsCancelModalOpen(false)} 
        title="CANCEL REGISTRATION"
      >
        <div className="p-6 pt-0">
          <p className="text-base text-stitch-on-surface-variant mb-8 leading-relaxed">
            Are you sure you want to cancel your registration for <span className="font-semibold text-stitch-on-surface">{event.title}</span>? 
            {event.maxCapacity !== null && " This will free up your spot for someone on the waitlist."} This action cannot be undone.
          </p>

          <div className="flex flex-col sm:flex-row gap-4">
            <button 
              onClick={() => setIsCancelModalOpen(false)}
              disabled={isCanceling}
              className="w-full sm:w-auto px-6 py-3 border border-stitch-on-surface text-stitch-on-surface font-mono font-bold text-sm tracking-widest hover:bg-stitch-surface transition-colors uppercase disabled:opacity-50"
            >
              Keep Registration
            </button>
            <button 
              onClick={handleCancelConfirm}
              disabled={isCanceling}
              className="w-full sm:flex-1 px-6 py-3 bg-red-600 text-white font-mono font-bold text-sm tracking-widest hover:bg-red-700 transition-colors uppercase disabled:opacity-50"
            >
              {isCanceling ? 'Processing...' : 'Cancel Registration'}
            </button>
          </div>
        </div>
      </Modal>

      {/* TEAM GATEWAY MODAL */}
      <TeamGatewayModal 
        eventId={eventId}
        isOpen={isTeamGatewayOpen}
        onClose={() => setIsTeamGatewayOpen(false)}
      />

      <div className="w-full max-w-[1440px] mx-auto px-6 py-4 md:px-12 md:py-6 lg:px-16">
        
        {/* Back Button */}
        <button 
          onClick={() => router.back()}
          className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-widest text-stitch-on-surface hover:text-stitch-secondary transition-colors mb-2.5"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back
        </button>

        {/* Event Header */}
        <div className="border-b border-stitch-outline-variant pb-4 mb-5">
          {event.eventType && (
            <div className="text-[11px] font-mono font-bold tracking-widest uppercase mb-1 text-stitch-on-surface">
              {event.eventType.replace(/_/g, ' ')}
            </div>
          )}
          <h1 
            className="text-2xl sm:text-3xl md:text-4xl lg:text-[44px] font-black text-stitch-on-surface tracking-tight leading-tight mb-2 break-words"
            style={{ fontFamily: 'Syne, sans-serif' }}
          >
            {event.title}
          </h1>
          
          {primaryClub && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono text-stitch-secondary uppercase tracking-widest">Hosted by</span>
              <Link href={`/student/campus/clubs/${primaryClub.id}`} className="flex items-center gap-2 group w-fit">
                {primaryClub.bannerUrl ? (
                  <img src={primaryClub.bannerUrl} alt={primaryClub.name} className="w-6 h-6 object-cover border border-stitch-outline-variant" />
                ) : (
                  <div className="w-6 h-6 bg-stitch-surface-variant flex items-center justify-center text-xs font-bold text-stitch-secondary border border-stitch-outline-variant">
                    {primaryClub.name.charAt(0)}
                  </div>
                )}
                <span className="text-sm font-semibold text-stitch-on-surface group-hover:underline">{primaryClub.name}</span>
              </Link>
            </div>
          )}
        </div>

        {/* Main Content Layout (Desktop Grid: Left ~68%, Right ~32%) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 items-start">
          
          {/* Left Main Content Area */}
          <div className="lg:col-span-7 xl:col-span-8 space-y-6">
            
            <section>
              <h2 className="text-xs font-mono font-bold tracking-[0.2em] text-stitch-on-surface uppercase border-b border-stitch-outline-variant pb-1.5 mb-3">About the Event</h2>
              <div className="prose prose-gray max-w-none text-stitch-on-surface-variant leading-relaxed text-sm md:text-base break-words">
                {event.description ? (
                  event.description.split('\n').map((para, i) => (
                    <p key={i} className="mb-3">{para}</p>
                  ))
                ) : (
                  <p className="text-stitch-secondary italic">No description provided.</p>
                )}
              </div>
            </section>

            {event.metadata?.agenda && event.metadata.agenda.length > 0 && (
              <section>
                <h2 className="text-xs font-mono font-bold tracking-[0.2em] text-stitch-on-surface uppercase border-b border-stitch-outline-variant pb-1.5 mb-3">Agenda</h2>
                <div className="space-y-4">
                  {event.metadata.agenda.map((item, idx) => {
                    let formattedTime = item.time;
                    try {
                      formattedTime = timeFormatter.format(new Date(item.time));
                    } catch (e) {
                      // fallback
                    }
                    return (
                      <div key={idx} className="flex flex-col sm:flex-row gap-2 sm:gap-4 group">
                        <div className="w-20 flex-shrink-0">
                          <span className="text-xs font-mono font-bold text-stitch-on-surface tabular-nums">{formattedTime}</span>
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold text-stitch-on-surface mb-0.5">{item.title}</h3>
                          {item.description && (
                            <p className="text-xs text-stitch-on-surface-variant leading-relaxed">{item.description}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

          </div>

          {/* Right Sidebar Rail */}
          <div className="lg:col-span-5 xl:col-span-4 space-y-5">
            
            {/* Registration & Status Block */}
            <div>
              <h3 className="text-xs font-mono font-bold tracking-[0.2em] text-stitch-secondary uppercase border-b border-stitch-outline-variant pb-1.5 mb-3">Registration / Status</h3>
              
              {isClubAdminForEvent ? (
                <div className="p-5 border border-stitch-outline-variant flex flex-col items-start bg-stitch-surface mb-3">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-1.5 h-1.5 bg-stitch-primary rounded-full"></div>
                    <div className="text-[10px] font-mono font-bold tracking-[0.2em] uppercase text-stitch-primary">
                      Organizer Mode
                    </div>
                  </div>
                  
                  <h4 className="text-sm font-semibold text-stitch-on-surface mb-1.5">
                    You organize this event
                  </h4>
                  
                  <p className="text-xs text-stitch-on-surface-variant mb-5 leading-relaxed font-mono">
                    As a Club Admin for the primary organizing club, standard participation is disabled. Use the management portal to manage teams, attendance, and details.
                  </p>
                  
                  {event.state === 'DRAFT' && (
                    <button 
                      onClick={() => submitMutation.mutate(eventId)}
                      disabled={submitMutation.isPending}
                      className="w-full px-4 py-3 mb-2 bg-stitch-primary text-stitch-on-primary font-mono font-bold text-[10px] tracking-widest uppercase hover:opacity-80 transition-opacity disabled:opacity-50"
                    >
                      {submitMutation.isPending ? 'Submitting...' : 'Submit for Approval'}
                    </button>
                  )}
                  
                  <button 
                    onClick={() => {
                      setClubAdminMode(true);
                      if (primaryClub) setActiveClubId(primaryClub.id);
                      router.push(`/student/events/${eventId}/manage`);
                    }}
                    className="w-full px-4 py-3 bg-stitch-on-surface text-stitch-surface-container-lowest font-mono font-bold text-[10px] tracking-widest uppercase hover:opacity-80 transition-opacity flex items-center justify-between group"
                  >
                    <span>Manage Event</span>
                    <span className="transform group-hover:translate-x-1 transition-transform">→</span>
                  </button>
                </div>
              ) : (
                <>
                  {/* Active Registration or Team Context */}
                  {registration && (registration.status !== 'NOT_REGISTERED' || registration.team_id) ? (
                    <div>
                      {registration.status === 'CANCELLED' && (
                        <div className="text-sm font-semibold text-stitch-secondary mb-3">Your registration was cancelled.</div>
                      )}
                      
                      {event.registrationType === 'TEAM' && registration.team_id ? (
                        <div className="p-3 border border-stitch-outline-variant flex flex-col items-start bg-stitch-surface mb-3">
                          {isLoadingTeam ? (
                            <div className="w-full flex items-center justify-center py-3">
                              <div className="w-4 h-4 border-2 border-stitch-on-surface border-t-transparent rounded-full animate-spin"></div>
                            </div>
                          ) : isErrorTeam || !team ? (
                            <div className="w-full flex items-center justify-center py-3 text-red-600 text-xs font-mono font-bold uppercase tracking-widest text-center dark:text-red-400">
                              Unable to load team
                            </div>
                          ) : (
                            <>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-[10px] font-mono font-bold tracking-[0.2em] uppercase text-stitch-on-surface">TEAM</span>
                                {team.status && (
                                  <>
                                    <span className="w-1 h-1 bg-stitch-on-surface rounded-full opacity-30"></span>
                                    <span className="text-[10px] font-mono font-bold tracking-widest uppercase text-stitch-secondary">{team.status}</span>
                                  </>
                                )}
                              </div>
                              <div className="text-base font-semibold text-stitch-on-surface mb-0.5">{team.name}</div>
                              
                              <div className="text-xs text-stitch-on-surface-variant mb-2.5 font-mono uppercase tracking-wide">
                                {team.member_count} {event.metadata?.maximum_team_size ? `/ ${event.metadata.maximum_team_size}` : ''} MEMBERS
                              </div>
                              
                              {event.metadata?.minimum_team_size && team.member_count < event.metadata.minimum_team_size && (
                                <div className="w-full p-2 mb-2.5 bg-yellow-50 border border-yellow-200 text-yellow-800 text-xs flex gap-2 items-start leading-relaxed dark:bg-yellow-900/30 dark:border-yellow-700/50 dark:text-yellow-200">
                                  <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                                  <span>Below minimum of {event.metadata.minimum_team_size} members.</span>
                                </div>
                              )}
                              
                              <Link 
                                href={`/student/events/${eventId}/team`} 
                                className="w-full text-center px-4 py-2 bg-stitch-surface-container-lowest border border-stitch-on-surface text-stitch-on-surface font-mono font-bold text-xs tracking-widest hover:bg-stitch-on-surface hover:text-stitch-surface-container-lowest transition-colors uppercase block"
                              >
                                View Team
                              </Link>
                            </>
                          )}
                        </div>
                      ) : (
                        <>
                          {registration.status === 'REGISTERED' && (
                            <div className="text-sm font-semibold text-stitch-on-surface mb-2">You're registered for this event.</div>
                          )}
                          
                          {registration.status === 'WAITLISTED' && (
                            <div>
                              <div className="text-sm font-semibold text-stitch-on-surface mb-1">You are on the waitlist.</div>
                              {registration.waitlist_position && (
                                <div className="text-xs text-stitch-on-surface-variant mb-2">Position #{registration.waitlist_position} on the waitlist</div>
                              )}
                            </div>
                          )}
                        </>
                      )}

                      {renderCancellation()}
                    </div>
                  ) : (
                    /* Unregistered / CTA Action */
                    renderRegistrationAction()
                  )}
                </>
              )}
              {renderDisputeSection()}
            </div>

            {/* Details Block */}
            <div>
              <h3 className="text-xs font-mono font-bold tracking-[0.2em] text-stitch-secondary uppercase border-b border-stitch-outline-variant pb-1.5 mb-3">Details</h3>
              
              <div className="space-y-2.5">
                <div className="flex items-start gap-2.5">
                  <Calendar className="w-4 h-4 text-stitch-on-surface mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="text-[10px] font-mono text-stitch-secondary uppercase">Date</div>
                    <div className="text-sm font-medium text-stitch-on-surface">{dateFormatter.format(new Date(event.startTime))}</div>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <Clock className="w-4 h-4 text-stitch-on-surface mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="text-[10px] font-mono text-stitch-secondary uppercase">Time</div>
                    <div className="text-sm font-medium text-stitch-on-surface">
                      {timeFormatter.format(new Date(event.startTime))} — {timeFormatter.format(new Date(event.endTime))}
                    </div>
                  </div>
                </div>

                {event.locationName && (
                  <div className="flex items-start gap-2.5">
                    <MapPin className="w-4 h-4 text-stitch-on-surface mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="text-[10px] font-mono text-stitch-secondary uppercase">Location</div>
                      <div className="text-sm font-medium text-stitch-on-surface break-words">{event.locationName}</div>
                    </div>
                  </div>
                )}

                {event.registrationType && (
                  <div className="flex items-start gap-2.5">
                    <Users className="w-4 h-4 text-stitch-on-surface mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="text-[10px] font-mono text-stitch-secondary uppercase">Format</div>
                      <div className="text-sm font-medium text-stitch-on-surface">
                        {event.registrationType === 'TEAM' ? (
                           <>
                             Team Event 
                             {event.metadata?.minimum_team_size && <span className="text-stitch-secondary font-normal ml-1">({event.metadata.minimum_team_size}-{event.metadata.maximum_team_size || '∞'} members)</span>}
                           </>
                        ) : 'Individual Registration'}
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Render Capacity only if API exposes maxCapacity and numeric registrationCount */}
                {event.maxCapacity !== null && typeof registrationCount === 'number' && (
                  <div className="flex items-start gap-2.5">
                    <Info className="w-4 h-4 text-stitch-on-surface mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="text-[10px] font-mono text-stitch-secondary uppercase">Capacity</div>
                      <div className="text-sm font-medium text-stitch-on-surface">
                        {registrationCount} / {event.maxCapacity} <span className="text-stitch-secondary font-normal">{event.registrationType === 'TEAM' ? 'teams' : 'people'}</span>
                      </div>
                    </div>
                  </div>
                )}

              </div>
            </div>
          </div>
        </div>
      </div>
      
      {disputeSessionId && (
        <AttendanceDisputeModal
          isOpen={!!disputeSessionId}
          onClose={() => setDisputeSessionId(null)}
          eventId={eventId}
          sessionId={disputeSessionId}
        />
      )}
    </div>
  );
}


