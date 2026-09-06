// ============================================================
// NST Events — Database Seed Script
// Phase 21: V1 Demo Data Seeding Execution
// ============================================================
// Run: pnpm db:seed  (from packages/database)
// ============================================================

import {
  PrismaClient,
  GlobalRole,
  ClubRole,
  ClubStatus,
  EventType,
  EventState,
  EventVisibility,
  RegistrationType,
  RegistrationStatus,
  AttendanceStatus,
  AttendanceMethod,
  AttendanceType,
  ParticipationRole,
  CompetitionResult,
  DisputeStatus,
  NotificationJobStatus,
} from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding NST Events database with extended V1 data...\n');

  // ----------------------------------------------------------
  // 1. USERS
  // ----------------------------------------------------------
  console.log('Creating users...');

  async function upsertUser(email: string, sub: string, name: string, role: GlobalRole) {
    return prisma.user.upsert({
      where: { email },
      update: { globalRole: role }, // Ensure role updates if changed
      create: { googleSub: sub, email, fullName: name, avatarUrl: null, globalRole: role },
    });
  }

  const userArjun = await upsertUser('arjun.mehta@adypu.edu.in', 'google-sub-arjun-001', 'Arjun Mehta', GlobalRole.STUDENT);
  const userPriya = await upsertUser('priya.sharma@adypu.edu.in', 'google-sub-priya-002', 'Priya Sharma', GlobalRole.STUDENT);
  const userRohan = await upsertUser('rohan.verma@adypu.edu.in', 'google-sub-rohan-003', 'Rohan Verma', GlobalRole.STUDENT);
  const userAnanya = await upsertUser('ananya.gupta@adypu.edu.in', 'google-sub-ananya-004', 'Ananya Gupta', GlobalRole.STUDENT);
  const userFacultyDr = await upsertUser('dr.kapoor@adypu.edu.in', 'google-sub-drkapoor-005', 'Dr. Sunita Kapoor', GlobalRole.FACULTY_ADMIN);
  const userPlatformAdmin = await upsertUser('admin@newtonschool.co', 'google-sub-admin-006', 'NST Platform Admin', GlobalRole.PLATFORM_ADMIN);
  const userVishwa = await upsertUser('vishwa.pillai@adypu.edu.in', 'google-sub-vishwa-007', 'Vishwanath Pillai', GlobalRole.STUDENT);
  const userNisha = await upsertUser('nisha.raj@adypu.edu.in', 'google-sub-nisha-008', 'Nisha Raj', GlobalRole.STUDENT);
  
  const userSoham = await upsertUser('e25b070564@adypu.edu.in', 'google-sub-soham-001', 'Soham Dhande', GlobalRole.PLATFORM_ADMIN);
  const userStudent1 = await upsertUser('student01@adypu.edu.in', 'gsub-s1', 'Student 01', GlobalRole.STUDENT);
  const userStudent2 = await upsertUser('student02@adypu.edu.in', 'gsub-s2', 'Student 02', GlobalRole.STUDENT);
  const userStudent3 = await upsertUser('student03@adypu.edu.in', 'gsub-s3', 'Student 03', GlobalRole.STUDENT);
  const userStudent4 = await upsertUser('student04@adypu.edu.in', 'gsub-s4', 'Student 04', GlobalRole.STUDENT);
  const userStudent5 = await upsertUser('student05@adypu.edu.in', 'gsub-s5', 'Student 05', GlobalRole.STUDENT);
  const userClubAdmin = await upsertUser('clubadmin@adypu.edu.in', 'gsub-ca', 'Club Admin User', GlobalRole.STUDENT);
  const userCoreMember = await upsertUser('coremember@adypu.edu.in', 'gsub-cm', 'Core Member User', GlobalRole.STUDENT);
  const userFacultyMentor = await upsertUser('facultymentor@adypu.edu.in', 'gsub-fm', 'Faculty Mentor User', GlobalRole.FACULTY_MENTOR);

  console.log('  ✓ Created/verified users\n');

  // ----------------------------------------------------------
  // 2. CLUBS
  // ----------------------------------------------------------
  console.log('Creating clubs...');

  async function upsertClub(name: string, desc: string, status: ClubStatus) {
    return prisma.club.upsert({
      where: { name },
      update: { status },
      create: { name, description: desc, status },
    });
  }

  const clubDevs = await upsertClub('NST Developers Club', 'Building software and shaping the future of technology at NST.', ClubStatus.ACTIVE);
  const clubRobotics = await upsertClub('NST Robotics Club', 'Designing, building, and programming autonomous robots for competition.', ClubStatus.ACTIVE);
  const clubECell = await upsertClub('NST E-Cell', 'Fostering the entrepreneurial mindset and supporting student startups.', ClubStatus.INACTIVE);
  const clubAIML = await upsertClub('AI/ML Club', 'Exploring Artificial Intelligence, Machine Learning, and Data Science.', ClubStatus.ACTIVE);
  const clubDesign = await upsertClub('Design Club', 'UI/UX, Graphic Design, and creative problem solving.', ClubStatus.ACTIVE);

  console.log('  ✓ Created/verified clubs\n');

  // ----------------------------------------------------------
  // 3. CLUB MEMBERSHIPS
  // ----------------------------------------------------------
  console.log('Creating club memberships...');

  async function upsertMembership(userId: string, clubId: string, role: ClubRole) {
    const existing = await prisma.clubMembership.findFirst({ where: { userId, clubId, deletedAt: null } });
    if (!existing) {
      return prisma.clubMembership.create({ data: { userId, clubId, role } });
    }
    return existing;
  }

  await upsertMembership(userArjun.id, clubDevs.id, ClubRole.CLUB_ADMIN);
  await upsertMembership(userPriya.id, clubDevs.id, ClubRole.CORE_MEMBER);
  await upsertMembership(userRohan.id, clubDevs.id, ClubRole.MEMBER);
  await upsertMembership(userFacultyDr.id, clubDevs.id, ClubRole.FACULTY_MENTOR);
  await upsertMembership(userVishwa.id, clubRobotics.id, ClubRole.CLUB_ADMIN);
  await upsertMembership(userAnanya.id, clubDevs.id, ClubRole.MEMBER);
  await upsertMembership(userAnanya.id, clubRobotics.id, ClubRole.MEMBER);
  
  await upsertMembership(userClubAdmin.id, clubAIML.id, ClubRole.CLUB_ADMIN);
  await upsertMembership(userCoreMember.id, clubAIML.id, ClubRole.CORE_MEMBER);
  await upsertMembership(userStudent1.id, clubAIML.id, ClubRole.MEMBER);
  await upsertMembership(userStudent2.id, clubAIML.id, ClubRole.MEMBER);
  await upsertMembership(userFacultyMentor.id, clubAIML.id, ClubRole.FACULTY_MENTOR);

  await upsertMembership(userClubAdmin.id, clubDesign.id, ClubRole.CLUB_ADMIN);
  await upsertMembership(userStudent3.id, clubDesign.id, ClubRole.MEMBER);
  await upsertMembership(userStudent4.id, clubDesign.id, ClubRole.MEMBER);

  console.log('  ✓ Created/verified club memberships\n');

  // ----------------------------------------------------------
  // 4. EVENTS
  // ----------------------------------------------------------
  console.log('Creating events...');

  async function upsertEvent(title: string, data: Parameters<typeof prisma.event.create>[0]['data']) {
    const existing = await prisma.event.findFirst({ where: { title, deletedAt: null } });
    if (!existing) {
      return prisma.event.create({ data });
    }
    return existing;
  }

  const now = new Date();
  
  // Past Event
  const eventTechSymposium = await upsertEvent('Tech Symposium 2026', {
    title: 'Tech Symposium 2026',
    description: 'A massive multi-club tech symposium from earlier this year.',
    startTime: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
    endTime: new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000),
    locationName: 'Main Auditorium',
    eventType: EventType.SEMINAR,
    state: EventState.PUBLISHED,
    visibility: EventVisibility.PUBLIC,
    registrationType: RegistrationType.INDIVIDUAL,
    attendanceType: AttendanceType.MULTI_SESSION,
    isLocked: false,
    maxCapacity: 200,
    registrationCount: 15,
    createdBy: userClubAdmin.id,
  });

  // Pending Event
  const eventDesignWorkshop = await upsertEvent('Design Workshop: Figma Basics', {
    title: 'Design Workshop: Figma Basics',
    description: 'Introductory workshop to UI design using Figma.',
    startTime: new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000), // 10 days future
    endTime: new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000),
    locationName: 'Design Lab 1',
    eventType: EventType.WORKSHOP,
    state: EventState.PENDING_APPROVAL,
    visibility: EventVisibility.PUBLIC,
    registrationType: RegistrationType.INDIVIDUAL,
    attendanceType: AttendanceType.SINGLE,
    isLocked: false,
    maxCapacity: 30,
    registrationCount: 0,
    createdBy: userClubAdmin.id,
  });

  // Locked/Waitlisted Event
  const eventAIHackathon = await upsertEvent('AI Hackathon: Future Tech', {
    title: 'AI Hackathon: Future Tech',
    description: 'Build the future of AI. Registration is currently locked for review.',
    startTime: new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000),
    endTime: new Date(now.getTime() + 16 * 24 * 60 * 60 * 1000),
    locationName: 'Innovation Hub',
    eventType: EventType.HACKATHON,
    state: EventState.PUBLISHED,
    visibility: EventVisibility.PUBLIC,
    registrationType: RegistrationType.TEAM,
    attendanceType: AttendanceType.MULTI_SESSION,
    isLocked: true, // Registration locked
    maxCapacity: 50,
    registrationCount: 8,
    createdBy: userClubAdmin.id,
  });

  // Draft Event
  const eventFutureSeminar = await upsertEvent('Future Trends Seminar', {
    title: 'Future Trends Seminar',
    description: 'A drafted seminar event.',
    startTime: new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000),
    endTime: new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000),
    locationName: 'TBD',
    eventType: EventType.SEMINAR,
    state: EventState.DRAFT,
    visibility: EventVisibility.PRIVATE,
    registrationType: RegistrationType.INDIVIDUAL,
    attendanceType: AttendanceType.SINGLE,
    isLocked: false,
    maxCapacity: null,
    registrationCount: 0,
    createdBy: userCoreMember.id,
  });

  console.log('  ✓ Created/verified events\n');

  // ----------------------------------------------------------
  // 5. EVENT_CLUBS
  // ----------------------------------------------------------
  console.log('Creating event_clubs mappings...');

  async function upsertEventClub(eventId: string, clubId: string, isPrimary: boolean) {
    return prisma.eventClub.upsert({
      where: { eventId_clubId: { eventId, clubId } },
      update: {},
      create: { eventId, clubId, isPrimary },
    });
  }

  await upsertEventClub(eventTechSymposium.id, clubAIML.id, true);
  await upsertEventClub(eventTechSymposium.id, clubDevs.id, false);
  await upsertEventClub(eventDesignWorkshop.id, clubDesign.id, true);
  await upsertEventClub(eventAIHackathon.id, clubAIML.id, true);
  await upsertEventClub(eventFutureSeminar.id, clubAIML.id, true);

  console.log('  ✓ Created/verified event_clubs mappings\n');

  // ----------------------------------------------------------
  // 6. TEAMS
  // ----------------------------------------------------------
  console.log('Creating teams...');

  async function upsertTeam(eventId: string, name: string, leaderId: string) {
    const existing = await prisma.team.findFirst({ where: { eventId, name, deletedAt: null } });
    if (!existing) {
      return prisma.team.create({ data: { eventId, name, normalizedName: name.trim().toLowerCase(), leaderId } });
    }
    return existing;
  }

  const teamAI_A = await upsertTeam(eventAIHackathon.id, 'Neural Ninjas', userStudent1.id);
  const teamAI_B = await upsertTeam(eventAIHackathon.id, 'Data Driven', userStudent3.id);

  console.log('  ✓ Created/verified teams\n');

  // ----------------------------------------------------------
  // 7. EVENT REGISTRATIONS
  // ----------------------------------------------------------
  console.log('Creating event registrations...');

  async function upsertRegistration(
    eventId: string,
    userId: string,
    teamId: string | null,
    registrationStatus: RegistrationStatus,
    participationRole: ParticipationRole,
  ) {
    const existing = await prisma.eventRegistration.findFirst({
      where: { eventId, userId, deletedAt: null },
    });
    if (!existing) {
      return prisma.eventRegistration.create({
        data: { eventId, userId, teamId, registrationStatus, participationRole },
      });
    }
    return existing;
  }

  // Tech Symposium Registrations (Registered & Cancelled)
  await upsertRegistration(eventTechSymposium.id, userStudent1.id, null, RegistrationStatus.REGISTERED, ParticipationRole.ATTENDEE);
  await upsertRegistration(eventTechSymposium.id, userStudent2.id, null, RegistrationStatus.REGISTERED, ParticipationRole.ATTENDEE);
  await upsertRegistration(eventTechSymposium.id, userStudent3.id, null, RegistrationStatus.REGISTERED, ParticipationRole.ATTENDEE);
  await upsertRegistration(eventTechSymposium.id, userStudent4.id, null, RegistrationStatus.CANCELLED, ParticipationRole.ATTENDEE);

  // AI Hackathon Registrations (Waitlisted)
  await upsertRegistration(eventAIHackathon.id, userStudent1.id, teamAI_A.id, RegistrationStatus.REGISTERED, ParticipationRole.ATTENDEE);
  await upsertRegistration(eventAIHackathon.id, userStudent2.id, teamAI_A.id, RegistrationStatus.REGISTERED, ParticipationRole.ATTENDEE);
  await upsertRegistration(eventAIHackathon.id, userStudent3.id, teamAI_B.id, RegistrationStatus.REGISTERED, ParticipationRole.ATTENDEE);
  await upsertRegistration(eventAIHackathon.id, userStudent4.id, teamAI_B.id, RegistrationStatus.WAITLISTED, ParticipationRole.ATTENDEE);
  await upsertRegistration(eventAIHackathon.id, userStudent5.id, null, RegistrationStatus.WAITLISTED, ParticipationRole.ATTENDEE);

  console.log('  ✓ Created/verified event registrations\n');

  // ----------------------------------------------------------
  // 8. ATTENDANCE SESSIONS & RECORDS
  // ----------------------------------------------------------
  console.log('Creating attendance sessions and records...');

  async function upsertSession(eventId: string, title: string, startTime: Date, endTime: Date, openAt: Date, closeAt: Date) {
    const existing = await prisma.attendanceSession.findFirst({ where: { eventId, title, deletedAt: null } });
    if (!existing) {
      return prisma.attendanceSession.create({
        data: { eventId, title, startTime, endTime, openAt, closeAt, geofenceRadius: 50, qrSecret: crypto.randomBytes(32).toString('hex'), createdBy: userPlatformAdmin.id },
      });
    }
    return existing;
  }

  async function upsertAttendanceRecord(sessionId: string, userId: string, status: AttendanceStatus) {
    const existing = await prisma.attendanceRecord.findUnique({
      where: { sessionId_userId: { sessionId, userId } },
    });
    if (!existing) {
      return prisma.attendanceRecord.create({
        data: {
          sessionId, userId, markedBy: null, method: AttendanceMethod.QR, status,
          auditMetadata: { device_os: 'iOS', flagged: false }
        }
      });
    }
    return existing;
  }

  const sessionTechSymp = await upsertSession(
    eventTechSymposium.id,
    'Main Keynote Check-in',
    eventTechSymposium.startTime,
    eventTechSymposium.endTime,
    new Date(eventTechSymposium.startTime.getTime() - 15*60000),
    new Date(eventTechSymposium.startTime.getTime() + 45*60000)
  );

  await upsertAttendanceRecord(sessionTechSymp.id, userStudent1.id, AttendanceStatus.PRESENT);
  await upsertAttendanceRecord(sessionTechSymp.id, userStudent2.id, AttendanceStatus.PRESENT);
  await upsertAttendanceRecord(sessionTechSymp.id, userStudent3.id, AttendanceStatus.ABSENT);

  console.log('  ✓ Created/verified attendance data\n');

  // ----------------------------------------------------------
  // 9. NOTIFICATIONS
  // ----------------------------------------------------------
  console.log('Creating notifications...');
  
  const existingNotifs = await prisma.notification.count({ where: { userId: userSoham.id } });
  if (existingNotifs === 0) {
    await prisma.notification.createMany({
      data: [
        {
          userId: userSoham.id,
          title: 'Welcome Platform Admin!',
          body: 'Your account has been elevated to Platform Admin. You now have full access.',
          type: 'SYSTEM_ALERT',
          metadata: { screen: 'Dashboard' },
          deliveredAt: new Date(),
        },
        {
          userId: userSoham.id,
          title: 'Event Approval Pending',
          body: 'Design Workshop requires your approval to be published.',
          type: 'APPROVAL_REQUEST',
          metadata: { screen: 'Approvals' },
          deliveredAt: new Date(),
        },
        {
          userId: userStudent1.id,
          title: 'Waitlist Update',
          body: 'You have been promoted from the waitlist for AI Hackathon.',
          type: 'REGISTRATION_UPDATE',
          readAt: new Date(), // Read
          metadata: { screen: 'EventDetails' },
          deliveredAt: new Date(now.getTime() - 86400000),
        }
      ]
    });
  }

  console.log('  ✓ Created/verified notifications\n');

  // ----------------------------------------------------------
  // 10. AUDIT LOGS
  // ----------------------------------------------------------
  console.log('Creating audit logs...');
  const existingAuditLogs = await prisma.auditLog.count({ where: { actorId: userSoham.id } });
  if (existingAuditLogs === 0) {
    await prisma.auditLog.createMany({
      data: [
        {
          actorId: userSoham.id,
          action: 'ROLE_UPDATED',
          entityType: 'users',
          entityId: userStudent1.id,
          previousState: { globalRole: 'STUDENT' },
          newState: { globalRole: 'STUDENT' }, // Dummy
          ipAddress: '127.0.0.1'
        },
        {
          actorId: userPlatformAdmin.id,
          action: 'EVENT_APPROVED',
          entityType: 'events',
          entityId: eventTechSymposium.id,
          previousState: { state: 'PENDING_APPROVAL' },
          newState: { state: 'PUBLISHED' },
          ipAddress: '127.0.0.1'
        }
      ]
    });
  }
  console.log('  ✓ Created/verified audit logs\n');

  // ----------------------------------------------------------
  // 11. QUEUE / DEAD LETTER
  // ----------------------------------------------------------
  console.log('Creating DLQ (NotificationJob) records...');
  const existingJob = await prisma.notificationJob.findFirst({ where: { idempotencyKey: 'dlq-test-job-001' } });
  if (!existingJob) {
    await prisma.notificationJob.create({
      data: {
        status: NotificationJobStatus.DEAD_LETTER,
        payload: { email: 'invalid@example.com', template: 'WELCOME' },
        priority: 'HIGH',
        attemptCount: 4,
        maxAttempts: 4,
        idempotencyKey: 'dlq-test-job-001',
        lastError: 'SMTP Connect Error: Connection timeout after 5000ms',
      }
    });
  }
  
  const existingJob2 = await prisma.notificationJob.findFirst({ where: { idempotencyKey: 'pending-test-job-002' } });
  if (!existingJob2) {
    await prisma.notificationJob.create({
      data: {
        status: NotificationJobStatus.PENDING,
        payload: { push: 'ExponentPushToken[mock-123]' },
        priority: 'NORMAL',
        idempotencyKey: 'pending-test-job-002',
      }
    });
  }
  console.log('  ✓ Created/verified dead-letter queue records\n');

  // ----------------------------------------------------------
  // 12. LEADERBOARD SCORES
  // ----------------------------------------------------------
  console.log('Creating leaderboard scores...');
  const existingScore = await prisma.leaderboardScore.findFirst({ where: { userId: userStudent1.id, reason: 'Attended Tech Symposium' }});
  if (!existingScore) {
    await prisma.leaderboardScore.createMany({
      data: [
        {
          userId: userStudent1.id,
          clubId: clubAIML.id,
          points: 100,
          reason: 'Attended Tech Symposium',
          sourceId: sessionTechSymp.id,
        },
        {
          userId: userStudent2.id,
          clubId: clubAIML.id,
          points: 100,
          reason: 'Attended Tech Symposium',
          sourceId: sessionTechSymp.id,
        }
      ]
    });
  }
  console.log('  ✓ Created/verified leaderboard scores\n');

  // ----------------------------------------------------------
  // SUMMARY
  // ----------------------------------------------------------
  const counts = {
    users: await prisma.user.count(),
    clubs: await prisma.club.count(),
    clubMemberships: await prisma.clubMembership.count(),
    events: await prisma.event.count(),
    eventClubs: await prisma.eventClub.count(),
    teams: await prisma.team.count(),
    eventRegistrations: await prisma.eventRegistration.count(),
    attendanceSessions: await prisma.attendanceSession.count(),
    attendanceRecords: await prisma.attendanceRecord.count(),
    notifications: await prisma.notification.count(),
    leaderboardScores: await prisma.leaderboardScore.count(),
    auditLogs: await prisma.auditLog.count(),
    notificationJobs: await prisma.notificationJob.count(),
  };

  console.log('✅ Seed complete! Record counts:');
  console.table(counts);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
