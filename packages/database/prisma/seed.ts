// ============================================================
// NST Events — Database Seed Script
// Phase 1: Realistic sample data to verify all relations.
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
} from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding NST Events database...\n');

  // ----------------------------------------------------------
  // 1. USERS
  // ----------------------------------------------------------
  console.log('Creating users...');

  const userArjun = await prisma.user.upsert({
    where: { email: 'arjun.mehta@adypu.edu.in' },
    update: {},
    create: {
      googleSub: 'google-sub-arjun-001',
      email: 'arjun.mehta@adypu.edu.in',
      fullName: 'Arjun Mehta',
      avatarUrl: null, // V1: file uploads deferred
      globalRole: GlobalRole.STUDENT,
    },
  });

  const userPriya = await prisma.user.upsert({
    where: { email: 'priya.sharma@adypu.edu.in' },
    update: {},
    create: {
      googleSub: 'google-sub-priya-002',
      email: 'priya.sharma@adypu.edu.in',
      fullName: 'Priya Sharma',
      avatarUrl: null,
      globalRole: GlobalRole.STUDENT,
    },
  });

  const userRohan = await prisma.user.upsert({
    where: { email: 'rohan.verma@adypu.edu.in' },
    update: {},
    create: {
      googleSub: 'google-sub-rohan-003',
      email: 'rohan.verma@adypu.edu.in',
      fullName: 'Rohan Verma',
      avatarUrl: null,
      globalRole: GlobalRole.STUDENT,
    },
  });

  const userAnanya = await prisma.user.upsert({
    where: { email: 'ananya.gupta@adypu.edu.in' },
    update: {},
    create: {
      googleSub: 'google-sub-ananya-004',
      email: 'ananya.gupta@adypu.edu.in',
      fullName: 'Ananya Gupta',
      avatarUrl: null,
      globalRole: GlobalRole.STUDENT,
    },
  });

  const userFacultyDr = await prisma.user.upsert({
    where: { email: 'dr.kapoor@adypu.edu.in' },
    update: {},
    create: {
      googleSub: 'google-sub-drkapoor-005',
      email: 'dr.kapoor@adypu.edu.in',
      fullName: 'Dr. Sunita Kapoor',
      avatarUrl: null,
      globalRole: GlobalRole.FACULTY_ADMIN,
    },
  });

  const userPlatformAdmin = await prisma.user.upsert({
    where: { email: 'admin@newtonschool.co' },
    update: {},
    create: {
      googleSub: 'google-sub-admin-006',
      email: 'admin@newtonschool.co',
      fullName: 'NST Platform Admin',
      avatarUrl: null,
      globalRole: GlobalRole.PLATFORM_ADMIN,
    },
  });

  const userVishwa = await prisma.user.upsert({
    where: { email: 'vishwa.pillai@adypu.edu.in' },
    update: {},
    create: {
      googleSub: 'google-sub-vishwa-007',
      email: 'vishwa.pillai@adypu.edu.in',
      fullName: 'Vishwanath Pillai',
      avatarUrl: null,
      globalRole: GlobalRole.STUDENT,
    },
  });

  const userNisha = await prisma.user.upsert({
    where: { email: 'nisha.raj@adypu.edu.in' },
    update: {},
    create: {
      googleSub: 'google-sub-nisha-008',
      email: 'nisha.raj@adypu.edu.in',
      fullName: 'Nisha Raj',
      avatarUrl: null,
      globalRole: GlobalRole.STUDENT,
    },
  });

  console.log(`  ✓ Created/verified 8 users\n`);

  // ----------------------------------------------------------
  // 2. CLUBS
  // ----------------------------------------------------------
  console.log('Creating clubs...');

  const clubDevs = await prisma.club.upsert({
    where: { name: 'NST Developers Club' },
    update: {},
    create: {
      name: 'NST Developers Club',
      description: 'Building software and shaping the future of technology at NST.',
      bannerUrl: null,
      status: ClubStatus.ACTIVE,
    },
  });

  const clubRobotics = await prisma.club.upsert({
    where: { name: 'NST Robotics Club' },
    update: {},
    create: {
      name: 'NST Robotics Club',
      description: 'Designing, building, and programming autonomous robots for competition.',
      bannerUrl: null,
      status: ClubStatus.ACTIVE,
    },
  });

  const clubECell = await prisma.club.upsert({
    where: { name: 'NST E-Cell' },
    update: {},
    create: {
      name: 'NST E-Cell',
      description: 'Fostering the entrepreneurial mindset and supporting student startups.',
      bannerUrl: null,
      status: ClubStatus.INACTIVE,
    },
  });

  console.log(`  ✓ Created/verified 3 clubs\n`);

  // ----------------------------------------------------------
  // 3. CLUB MEMBERSHIPS (idempotent via findFirst + create)
  // ----------------------------------------------------------
  console.log('Creating club memberships...');

  async function upsertMembership(userId: string, clubId: string, role: ClubRole) {
    const existing = await prisma.clubMembership.findFirst({
      where: { userId, clubId, deletedAt: null },
    });
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

  console.log(`  ✓ Created/verified 7 club memberships\n`);

  // ----------------------------------------------------------
  // 4. EVENTS
  // ----------------------------------------------------------
  console.log('Creating events...');

  // We upsert on title since there's no unique constraint on title alone.
  // For idempotency we use findFirst + create.
  async function upsertEvent(title: string, data: Parameters<typeof prisma.event.create>[0]['data']) {
    const existing = await prisma.event.findFirst({ where: { title, deletedAt: null } });
    if (!existing) {
      return prisma.event.create({ data });
    }
    return existing;
  }

  const eventHackathon = await upsertEvent('NST Winter Hackathon 2026', {
    title: 'NST Winter Hackathon 2026',
    description: 'A 36-hour team hackathon focused on AI/ML solutions for social impact.',
    startTime: new Date('2026-12-10T09:00:00+05:30'),
    endTime: new Date('2026-12-11T21:00:00+05:30'),
    locationName: 'NST Innovation Hub, Block C',
    eventType: EventType.HACKATHON,
    state: EventState.PUBLISHED,
    visibility: EventVisibility.PUBLIC,
    registrationType: RegistrationType.TEAM,
    attendanceType: AttendanceType.MULTI_SESSION,
    isLocked: false,
    maxCapacity: 120,
    registrationCount: 3,
    metadata: {
      team_size_min: 2,
      team_size_max: 4,
      prizes: ['MacBook Air M3', 'Mechanical Keyboard', 'Online Course Vouchers'],
      theme: 'AI for Social Good',
    },
    createdBy: userArjun.id,
  });

  const eventWorkshop = await upsertEvent('TypeScript & Prisma Workshop', {
    title: 'TypeScript & Prisma Workshop',
    description: 'Learn type-safe database access patterns with Prisma ORM and PostgreSQL.',
    startTime: new Date('2026-09-15T14:00:00+05:30'),
    endTime: new Date('2026-09-15T17:00:00+05:30'),
    locationName: 'Computer Lab 3, Academic Block',
    eventType: EventType.WORKSHOP,
    state: EventState.PUBLISHED,
    visibility: EventVisibility.PUBLIC,
    registrationType: RegistrationType.INDIVIDUAL,
    attendanceType: AttendanceType.SINGLE,
    isLocked: false,
    maxCapacity: 40,
    registrationCount: 3,
    metadata: {
      prerequisites: ['Basic TypeScript', 'Node.js fundamentals'],
      speaker_name: 'Arjun Mehta',
      speaker_bio: 'Club Admin, NST Developers Club',
    },
    createdBy: userArjun.id,
  });

  const eventCompetition = await upsertEvent('Inter-Club Robotics Challenge', {
    title: 'Inter-Club Robotics Challenge',
    description: 'Head-to-head autonomous robot navigation competition.',
    startTime: new Date('2027-01-20T10:00:00+05:30'),
    endTime: new Date('2027-01-20T18:00:00+05:30'),
    locationName: 'NST Robotics Lab',
    eventType: EventType.COMPETITION,
    state: EventState.DRAFT,
    visibility: EventVisibility.PUBLIC,
    registrationType: RegistrationType.INDIVIDUAL,
    attendanceType: AttendanceType.SINGLE,
    isLocked: false,
    maxCapacity: 30,
    registrationCount: 0,
    metadata: {
      judging_criteria: ['Speed', 'Accuracy', 'Robustness'],
      prize_pool: '₹25,000',
    },
    createdBy: userVishwa.id,
  });

  console.log(`  ✓ Created/verified 3 events\n`);

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

  await upsertEventClub(eventHackathon.id, clubDevs.id, true);
  await upsertEventClub(eventHackathon.id, clubRobotics.id, false);
  await upsertEventClub(eventWorkshop.id, clubDevs.id, true);
  await upsertEventClub(eventCompetition.id, clubRobotics.id, true);

  console.log(`  ✓ Created/verified 4 event_clubs mappings\n`);

  // ----------------------------------------------------------
  // 6. TEAMS
  // ----------------------------------------------------------
  console.log('Creating teams...');

  async function upsertTeam(eventId: string, name: string, leaderId: string) {
    const existing = await prisma.team.findFirst({ where: { eventId, name, deletedAt: null } });
    if (!existing) {
      return prisma.team.create({ data: { eventId, name, leaderId } });
    }
    return existing;
  }

  const teamAlpha = await upsertTeam(eventHackathon.id, 'Team Alpha', userArjun.id);
  const teamBeta = await upsertTeam(eventHackathon.id, 'Team Beta', userVishwa.id);

  console.log(`  ✓ Created/verified 2 teams\n`);

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

  // Hackathon registrations (team-based)
  await upsertRegistration(eventHackathon.id, userArjun.id, teamAlpha.id, RegistrationStatus.REGISTERED, ParticipationRole.ORGANIZER);
  await upsertRegistration(eventHackathon.id, userPriya.id, teamAlpha.id, RegistrationStatus.REGISTERED, ParticipationRole.ATTENDEE);
  await upsertRegistration(eventHackathon.id, userVishwa.id, teamBeta.id, RegistrationStatus.REGISTERED, ParticipationRole.ATTENDEE);

  // Workshop registrations (individual)
  await upsertRegistration(eventWorkshop.id, userPriya.id, null, RegistrationStatus.REGISTERED, ParticipationRole.ATTENDEE);
  await upsertRegistration(eventWorkshop.id, userRohan.id, null, RegistrationStatus.REGISTERED, ParticipationRole.ATTENDEE);
  await upsertRegistration(eventWorkshop.id, userAnanya.id, null, RegistrationStatus.WAITLISTED, ParticipationRole.ATTENDEE);

  console.log(`  ✓ Created/verified 6 event registrations\n`);

  // ----------------------------------------------------------
  // 8. ATTENDANCE SESSIONS
  // ----------------------------------------------------------
  console.log('Creating attendance sessions...');

  async function upsertSession(eventId: string, title: string, startTime: Date, endTime: Date, openAt: Date, closeAt: Date, geofenceRadius: number) {
    const existing = await prisma.attendanceSession.findFirst({ where: { eventId, title, deletedAt: null } });
    if (!existing) {
      return prisma.attendanceSession.create({
        data: { eventId, title, startTime, endTime, openAt, closeAt, geofenceRadius, qrSecret: crypto.randomBytes(32).toString('hex'), createdBy: userPlatformAdmin.id },
      });
    }
    return existing;
  }

  const sessionWorkshop = await upsertSession(
    eventWorkshop.id,
    'Workshop Day 1 — Main Session',
    new Date('2026-09-15T14:00:00+05:30'),
    new Date('2026-09-15T17:00:00+05:30'),
    new Date('2026-09-15T13:45:00+05:30'),
    new Date('2026-09-15T14:30:00+05:30'),
    50,
  );

  const sessionHackDay1 = await upsertSession(
    eventHackathon.id,
    'Hackathon — Day 1 Check-in',
    new Date('2026-12-10T09:00:00+05:30'),
    new Date('2026-12-10T10:00:00+05:30'),
    new Date('2026-12-10T08:45:00+05:30'),
    new Date('2026-12-10T09:30:00+05:30'),
    100,
  );

  const sessionHackDay2 = await upsertSession(
    eventHackathon.id,
    'Hackathon — Day 2 Check-in',
    new Date('2026-12-11T09:00:00+05:30'),
    new Date('2026-12-11T10:00:00+05:30'),
    new Date('2026-12-11T08:45:00+05:30'),
    new Date('2026-12-11T09:30:00+05:30'),
    100,
  );

  console.log(`  ✓ Created/verified 3 attendance sessions\n`);

  // ----------------------------------------------------------
  // 9. ATTENDANCE RECORDS
  // ----------------------------------------------------------
  console.log('Creating attendance records...');

  async function upsertAttendanceRecord(sessionId: string, userId: string, data: Parameters<typeof prisma.attendanceRecord.create>[0]['data']) {
    const existing = await prisma.attendanceRecord.findUnique({
      where: { sessionId_userId: { sessionId, userId } },
    });
    if (!existing) {
      return prisma.attendanceRecord.create({ data });
    }
    return existing;
  }

  await upsertAttendanceRecord(sessionWorkshop.id, userPriya.id, {
    sessionId: sessionWorkshop.id,
    userId: userPriya.id,
    markedBy: null,
    markedAt: new Date('2026-09-15T14:08:00+05:30'),
    method: AttendanceMethod.QR,
    status: AttendanceStatus.PRESENT,
    auditMetadata: {
      device_id: 'device-priya-iphone14',
      device_os: 'iOS',
      gps_accuracy: 4.2,
      mock_location_detected: false,
      app_version: '1.0.0',
      flagged: false,
    },
  });

  await upsertAttendanceRecord(sessionWorkshop.id, userRohan.id, {
    sessionId: sessionWorkshop.id,
    userId: userRohan.id,
    markedBy: null,
    markedAt: new Date('2026-09-15T14:12:00+05:30'),
    method: AttendanceMethod.QR,
    status: AttendanceStatus.PRESENT,
    auditMetadata: {
      device_id: 'device-rohan-pixel8',
      device_os: 'Android',
      gps_accuracy: 6.1,
      mock_location_detected: false,
      app_version: '1.0.0',
      flagged: false,
    },
  });

  await upsertAttendanceRecord(sessionHackDay1.id, userArjun.id, {
    sessionId: sessionHackDay1.id,
    userId: userArjun.id,
    markedBy: userArjun.id,
    markedAt: new Date('2026-12-10T09:05:00+05:30'),
    method: AttendanceMethod.MANUAL,
    status: AttendanceStatus.PRESENT,
    auditMetadata: {
      device_id: 'device-arjun-samsung',
      device_os: 'Android',
      gps_accuracy: 3.8,
      mock_location_detected: false,
      app_version: '1.0.0',
      flagged: false,
    },
  });

  console.log(`  ✓ Created/verified 3 attendance records\n`);

  // ----------------------------------------------------------
  // 10. EVENT RESULTS
  // ----------------------------------------------------------
  console.log('Creating event results...');

  const existingResult = await prisma.eventResult.findUnique({
    where: { eventId_userId: { eventId: eventWorkshop.id, userId: userArjun.id } },
  });
  if (!existingResult) {
    await prisma.eventResult.create({
      data: {
        eventId: eventWorkshop.id,
        userId: userArjun.id,
        resultType: CompetitionResult.WINNER,
        createdBy: userFacultyDr.id,
      },
    });
  }

  console.log(`  ✓ Created/verified 1 event result\n`);

  // ----------------------------------------------------------
  // 11. NOTIFICATIONS
  // ----------------------------------------------------------
  console.log('Creating notifications...');

  const existingNotifs = await prisma.notification.count({ where: { userId: userPriya.id } });
  if (existingNotifs === 0) {
    await prisma.notification.createMany({
      data: [
        {
          userId: userPriya.id,
          title: 'Registration Confirmed',
          body: 'You are registered for NST Winter Hackathon 2026. Get ready!',
          type: 'EVENT_REGISTRATION',
          metadata: { screen: 'EventDetails', event_id: eventHackathon.id },
          deliveredAt: new Date('2026-08-01T10:00:00+05:30'),
        },
        {
          userId: userRohan.id,
          title: 'Workshop Reminder',
          body: "TypeScript & Prisma Workshop starts in 2 hours. Don't forget to bring your laptop!",
          type: 'EVENT_REMINDER',
          metadata: { screen: 'EventDetails', event_id: eventWorkshop.id },
          deliveredAt: new Date('2026-09-15T12:00:00+05:30'),
        },
        {
          userId: userArjun.id,
          title: 'Event Published',
          body: 'NST Winter Hackathon 2026 has been approved and published.',
          type: 'EVENT_STATE_CHANGE',
          metadata: { screen: 'EventDetails', event_id: eventHackathon.id },
          readAt: new Date('2026-08-01T11:00:00+05:30'),
          deliveredAt: new Date('2026-08-01T10:05:00+05:30'),
        },
      ],
    });
  }

  console.log(`  ✓ Created/verified 3 notifications\n`);

  // ----------------------------------------------------------
  // 12. NOTIFICATION PREFERENCES
  // ----------------------------------------------------------
  console.log('Creating notification preferences...');

  await prisma.notificationPreference.upsert({
    where: { userId: userPriya.id },
    update: {},
    create: {
      userId: userPriya.id,
      pushEnabled: true,
      eventReminders: true,
      clubAnnouncements: true,
      attendanceAlerts: true,
    },
  });

  await prisma.notificationPreference.upsert({
    where: { userId: userRohan.id },
    update: {},
    create: {
      userId: userRohan.id,
      pushEnabled: false,
      eventReminders: true,
      clubAnnouncements: false,
      attendanceAlerts: true,
    },
  });

  console.log(`  ✓ Created/verified 2 notification preferences\n`);

  // ----------------------------------------------------------
  // 13. PUSH TOKENS
  // ----------------------------------------------------------
  console.log('Creating push tokens...');

  await prisma.pushToken.upsert({
    where: { deviceId: 'device-priya-iphone14' },
    update: { expoToken: 'ExponentPushToken[priya-iphone14-token-001]', lastSeenAt: new Date() },
    create: {
      userId: userPriya.id,
      deviceId: 'device-priya-iphone14',
      expoToken: 'ExponentPushToken[priya-iphone14-token-001]',
      platform: 'ios',
      lastSeenAt: new Date(),
    },
  });

  await prisma.pushToken.upsert({
    where: { deviceId: 'device-rohan-pixel8' },
    update: { expoToken: 'ExponentPushToken[rohan-pixel8-token-001]', lastSeenAt: new Date() },
    create: {
      userId: userRohan.id,
      deviceId: 'device-rohan-pixel8',
      expoToken: 'ExponentPushToken[rohan-pixel8-token-001]',
      platform: 'android',
      lastSeenAt: new Date(),
    },
  });

  console.log(`  ✓ Created/verified 2 push tokens\n`);

  // ----------------------------------------------------------
  // 14. ANNOUNCEMENTS
  // ----------------------------------------------------------
  console.log('Creating announcements...');

  const existingAnnouncement = await prisma.announcement.findFirst({
    where: { title: 'Hackathon Team Formation Deadline' },
  });
  if (!existingAnnouncement) {
    await prisma.announcement.createMany({
      data: [
        {
          clubId: clubDevs.id,
          title: 'Hackathon Team Formation Deadline',
          content: 'All hackathon teams must be finalized by November 30th. Register your team on the NST Events app!',
          createdBy: userArjun.id,
        },
        {
          clubId: null, // global announcement
          title: 'Platform Maintenance Notice',
          content: 'NST Events will be down for scheduled maintenance on August 10th from 2:00–4:00 AM IST.',
          createdBy: userPlatformAdmin.id,
        },
      ],
    });
  }

  console.log(`  ✓ Created/verified 2 announcements\n`);

  // ----------------------------------------------------------
  // 15. LEADERBOARD SCORES
  // ----------------------------------------------------------
  console.log('Creating leaderboard scores...');

  const existingScore = await prisma.leaderboardScore.findFirst({
    where: { userId: userPriya.id, reason: 'Attended TypeScript & Prisma Workshop' },
  });
  if (!existingScore) {
    await prisma.leaderboardScore.createMany({
      data: [
        {
          userId: userPriya.id,
          clubId: clubDevs.id,
          points: 50,
          reason: 'Attended TypeScript & Prisma Workshop',
          sourceId: sessionWorkshop.id,
        },
        {
          userId: userRohan.id,
          clubId: clubDevs.id,
          points: 50,
          reason: 'Attended TypeScript & Prisma Workshop',
          sourceId: sessionWorkshop.id,
        },
        {
          userId: userArjun.id,
          clubId: clubDevs.id,
          points: 100,
          reason: 'Speaker at TypeScript & Prisma Workshop',
          sourceId: sessionWorkshop.id,
        },
      ],
    });
  }

  console.log(`  ✓ Created/verified 3 leaderboard scores\n`);

  // ----------------------------------------------------------
  // 16. ATTENDANCE DISPUTE
  // ----------------------------------------------------------
  console.log('Creating attendance dispute...');

  const existingDispute = await prisma.attendanceDispute.findUnique({
    where: { sessionId_userId: { sessionId: sessionHackDay2.id, userId: userPriya.id } },
  });
  if (!existingDispute) {
    await prisma.attendanceDispute.create({
      data: {
        attendanceRecordId: null,
        sessionId: sessionHackDay2.id,
        eventId: eventHackathon.id,
        userId: userPriya.id,
        reason: 'My phone battery died during check-in. I was physically present at the hackathon on Day 2.',
        evidenceUrls: ['https://nst-evidence.example.com/priya-hackathon-day2-selfie.jpg'],
        status: DisputeStatus.PENDING,
        disputeWindowExpiresAt: new Date('2026-12-18T23:59:00+05:30'),
        submittedAt: new Date('2026-12-11T15:00:00+05:30'),
      },
    });
  }

  console.log(`  ✓ Created/verified 1 attendance dispute\n`);

  // ----------------------------------------------------------
  // 17. LEADERSHIP HANDOVER REQUEST
  // ----------------------------------------------------------
  console.log('Creating leadership handover request...');

  const existingHandover = await prisma.leadershipHandoverRequest.findFirst({
    where: { clubId: clubDevs.id, status: 'PENDING' },
  });
  if (!existingHandover) {
    await prisma.leadershipHandoverRequest.create({
      data: {
        clubId: clubDevs.id,
        initiatedBy: userArjun.id,
        successorId: userPriya.id,
        facultyMentorId: userFacultyDr.id,
        status: 'PENDING',
        initiatedAt: new Date('2026-08-01T09:00:00+05:30'),
      },
    });
  }

  console.log(`  ✓ Created/verified 1 leadership handover request\n`);

  // ----------------------------------------------------------
  // 18. AUDIT LOG ENTRIES (sample — normally written by triggers)
  // ----------------------------------------------------------
  console.log('Creating sample audit log entries...');

  const existingAudit = await prisma.auditLog.count();
  if (existingAudit === 0) {
    await prisma.auditLog.createMany({
      data: [
        {
          actorId: userArjun.id,
          action: 'EVENT_STATE_CHANGE',
          entityType: 'events',
          entityId: eventWorkshop.id,
          previousState: { state: 'DRAFT' },
          newState: { state: 'PENDING_APPROVAL' },
          ipAddress: '10.0.0.42',
        },
        {
          actorId: userFacultyDr.id,
          action: 'EVENT_STATE_CHANGE',
          entityType: 'events',
          entityId: eventWorkshop.id,
          previousState: { state: 'PENDING_APPROVAL' },
          newState: { state: 'PUBLISHED' },
          ipAddress: '10.0.0.5',
        },
      ],
    });
  }

  console.log(`  ✓ Created/verified 2 audit log entries\n`);

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
    eventResults: await prisma.eventResult.count(),
    notifications: await prisma.notification.count(),
    notificationPreferences: await prisma.notificationPreference.count(),
    pushTokens: await prisma.pushToken.count(),
    announcements: await prisma.announcement.count(),
    leaderboardScores: await prisma.leaderboardScore.count(),
    attendanceDisputes: await prisma.attendanceDispute.count(),
    handoverRequests: await prisma.leadershipHandoverRequest.count(),
    auditLogs: await prisma.auditLog.count(),
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
