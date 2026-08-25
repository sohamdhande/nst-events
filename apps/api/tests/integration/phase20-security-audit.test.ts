import { describe, it, before as beforeAll, after as afterAll } from 'node:test';
import assert from 'node:assert';
import { adminPrisma as prisma } from '../helpers/adminDb';
import { createEvent, updateEvent, getEventById, submitForApproval, approveEvent, lockEvent } from '../../src/modules/events/events.service';
import { createTeam, inviteMember, acceptInvitation, joinTeam, leaveTeam } from '../../src/modules/teams/teams.service';
import { registerEvent } from '../../src/modules/registrations/registrations.service';
import { AttendanceType, EventAudience, EventState, EventType, EventVisibility, RegistrationType, AssignmentSource } from '@nst/database';

describe('Phase 20 Security Audit', () => {
  let adminId: string;
  let clubAdminAId: string;
  let clubAdminBId: string;
  let studentAId: string;
  let studentBId: string;
  let studentCId: string;
  let studentDId: string;
  let studentEId: string;

  let clubAId: string;
  let clubBId: string;
  
  let programXId: string;
  let batchXId: string;
  let batchYId: string;

  let eventAId: string;
  let teamAId: string;

  beforeAll(async () => {
    // Teardown first
    await prisma.eventRegistration.deleteMany({});
    await prisma.attendanceRecord.deleteMany({});
    await prisma.attendanceSession.deleteMany({});
    await prisma.teamInvitation.deleteMany({});
    await prisma.team.deleteMany({});
    await prisma.eventAudienceBatch.deleteMany({});
    await prisma.eventClub.deleteMany({});
    await prisma.event.deleteMany({});
    await prisma.userAcademicProfile.deleteMany({});
    await prisma.academicBatch.deleteMany({});
    await prisma.academicProgram.deleteMany({});
    await prisma.clubMembership.deleteMany({});
    await prisma.club.deleteMany({});
    await prisma.notification.deleteMany({});
    await prisma.user.deleteMany({ where: { email: { contains: 'audit20' } } });

    // Seed Data
    const admin = await prisma.user.create({ data: { email: 'admin_audit20@adypu.edu.in', fullName: 'Admin', globalRole: 'PLATFORM_ADMIN', googleSub: 'sub_admin_audit20' } });
    adminId = admin.id;

    const caA = await prisma.user.create({ data: { email: 'clubAdminA_audit20@adypu.edu.in', fullName: 'Club Admin A', globalRole: 'STUDENT', googleSub: 'sub_caA_audit20' } });
    clubAdminAId = caA.id;
    const caB = await prisma.user.create({ data: { email: 'clubAdminB_audit20@adypu.edu.in', fullName: 'Club Admin B', globalRole: 'STUDENT', googleSub: 'sub_caB_audit20' } });
    clubAdminBId = caB.id;

    const stA = await prisma.user.create({ data: { email: 'studentA_audit20@adypu.edu.in', fullName: 'Student A', globalRole: 'STUDENT', googleSub: 'sub_stA_audit20' } });
    studentAId = stA.id;
    const stB = await prisma.user.create({ data: { email: 'studentB_audit20@adypu.edu.in', fullName: 'Student B', globalRole: 'STUDENT', googleSub: 'sub_stB_audit20' } });
    studentBId = stB.id;
    const stC = await prisma.user.create({ data: { email: 'studentC_audit20@adypu.edu.in', fullName: 'Student C', globalRole: 'STUDENT', googleSub: 'sub_stC_audit20' } });
    studentCId = stC.id;
    const stD = await prisma.user.create({ data: { email: 'studentD_audit20@adypu.edu.in', fullName: 'Student D', globalRole: 'STUDENT', googleSub: 'sub_stD_audit20' } });
    studentDId = stD.id;
    const stE = await prisma.user.create({ data: { email: 'studentE_audit20@adypu.edu.in', fullName: 'Student E', globalRole: 'STUDENT', googleSub: 'sub_stE_audit20' } });
    studentEId = stE.id;

    const clubA = await prisma.club.create({ data: { name: 'Club A', status: 'ACTIVE' } });
    clubAId = clubA.id;
    const clubB = await prisma.club.create({ data: { name: 'Club B', status: 'ACTIVE' } });
    clubBId = clubB.id;

    await prisma.clubMembership.create({ data: { userId: clubAdminAId, clubId: clubAId, role: 'CLUB_ADMIN' } });
    await prisma.clubMembership.create({ data: { userId: clubAdminBId, clubId: clubBId, role: 'CLUB_ADMIN' } });

    const programX = await prisma.academicProgram.create({ data: { id: '00000000-0000-0000-0000-000000000020', name: 'B.Tech CSE Audit', code: 'CSE_AUDIT' } });
    programXId = programX.id;

    const batchX = await prisma.academicBatch.create({ data: { programId: programXId, admissionYear: 2025, graduationYear: 2029 } });
    batchXId = batchX.id;
    const batchY = await prisma.academicBatch.create({ data: { programId: programXId, admissionYear: 2026, graduationYear: 2030 } });
    batchYId = batchY.id;

    await prisma.userAcademicProfile.create({ data: { userId: studentAId, batchId: batchXId, assignmentSource: AssignmentSource.ADMIN_OVERRIDE } });
    await prisma.userAcademicProfile.create({ data: { userId: studentBId, batchId: batchXId, assignmentSource: AssignmentSource.ADMIN_OVERRIDE } });
    await prisma.userAcademicProfile.create({ data: { userId: studentDId, batchId: batchXId, assignmentSource: AssignmentSource.ADMIN_OVERRIDE } });
    await prisma.userAcademicProfile.create({ data: { userId: studentEId, batchId: batchXId, assignmentSource: AssignmentSource.ADMIN_OVERRIDE } });
    await prisma.userAcademicProfile.create({ data: { userId: clubAdminAId, batchId: batchXId, assignmentSource: AssignmentSource.ADMIN_OVERRIDE } });
    await prisma.userAcademicProfile.create({ data: { userId: clubAdminBId, batchId: batchXId, assignmentSource: AssignmentSource.ADMIN_OVERRIDE } });
    await prisma.userAcademicProfile.create({ data: { userId: studentCId, batchId: batchYId, assignmentSource: AssignmentSource.ADMIN_OVERRIDE } }); // Student C in batch Y
  });

  afterAll(async () => {
    // Teardown
    await prisma.eventRegistration.deleteMany({});
    await prisma.attendanceRecord.deleteMany({});
    await prisma.attendanceSession.deleteMany({});
    await prisma.teamInvitation.deleteMany({});
    await prisma.team.deleteMany({});
    await prisma.eventAudienceBatch.deleteMany({});
    await prisma.eventClub.deleteMany({});
    await prisma.event.deleteMany({});
    await prisma.userAcademicProfile.deleteMany({});
    await prisma.academicBatch.deleteMany({});
    await prisma.academicProgram.deleteMany({});
    await prisma.clubMembership.deleteMany({});
    await prisma.club.deleteMany({});
    await prisma.notification.deleteMany({});
    await prisma.user.deleteMany({ where: { email: { contains: 'audit20' } } });
  });

  it('1. Prepares Event A for testing (Draft)', async () => {
    const event = await createEvent(clubAdminAId, {
      title: 'Audit Event',
      start_time: new Date(Date.now() + 100000).toISOString(),
      end_time: new Date(Date.now() + 200000).toISOString(),
      event_type: EventType.HACKATHON,
      registration_type: RegistrationType.TEAM,
      attendance_type: AttendanceType.SINGLE,
      audience: EventAudience.SPECIFIC_BATCHES,
      audience_batch_ids: [batchXId],
      max_capacity: 5,
      metadata: { minimum_team_size: 2, maximum_team_size: 3 },
      club_ids: [{ club_id: clubAId, is_primary: true }],
    } as any);

    eventAId = event.id;
  });

  it('2. Club Scope Enforcement', async () => {
    // Club Admin B attempts to update Event A -> 403 Forbidden
    await assert.rejects(updateEvent(clubAdminBId, eventAId, {
      title: 'Hacked Title'
    } as any), /Forbidden|Unauthorized|Event not found/i);
    
    // Club Admin B attempts to lock Event A
    await assert.rejects(lockEvent(clubAdminBId, eventAId), /Forbidden|Unauthorized|Event not found/i);
  });

  it('2.5. Approves Event A', async () => {
    await submitForApproval(clubAdminAId, eventAId);
    await approveEvent(adminId, eventAId);
  });

  it('3. BOLA / IDOR - Teams and Invitations', async () => {
    const team = await createTeam(studentAId, eventAId, 'Team A');
    teamAId = (team as any).team_id;

    // Student B attempts to read Student A team members directly?
    // Wait, get_team_member_ids is tested in teams-security.test.ts, let's try inviting someone and B accepting it
    
    // Student A invites Student B
    const inv = await inviteMember(studentAId, teamAId, studentBId);

    // Student C attempts to accept Student B's invitation
    await assert.rejects(acceptInvitation(studentCId, teamAId, inv.id), /NotFound|Forbidden/);
    
    // Student C attempts to leave Team A (they are not in it)
    await assert.rejects(leaveTeam(studentCId, teamAId), /NotFound|Forbidden|Not in team|Registration not found/i);
  });

  it('4. Concurrent Duplicate Team Creation', async () => {
    // Student B attempts to create two teams concurrently
    const results = await Promise.allSettled([
      createTeam(studentBId, eventAId, 'Team B1'),
      createTeam(studentBId, eventAId, 'Team B2'),
    ]);

    const successes = results.filter(r => r.status === 'fulfilled');
    assert.strictEqual(successes.length, 1, 'Only one team creation should succeed due to unique registration constraint');
  });

  it('5. Concurrent Duplicate Invitation Acceptance', async () => {
    // Let's create an event B that is individual
    const ev = await createEvent(adminId, {
      title: 'Race Event',
      start_time: new Date(Date.now() + 100000).toISOString(),
      end_time: new Date(Date.now() + 200000).toISOString(),
      event_type: EventType.MEETUP,
      registration_type: RegistrationType.TEAM,
      attendance_type: AttendanceType.SINGLE,
      audience: EventAudience.ALL_STUDENTS,
      max_capacity: 10,
      metadata: { minimum_team_size: 1, maximum_team_size: 2 },
      club_ids: [{ club_id: clubAId, is_primary: true }],
    } as any);
    await submitForApproval(clubAdminAId, ev.id);
    await approveEvent(adminId, ev.id);

    const team = await createTeam(studentCId, ev.id, 'Race Team');
    const tId = (team as any).team_id;

    const inv = await inviteMember(studentCId, tId, studentBId);

    // B accepts twice concurrently
    const accepts = await Promise.allSettled([
      acceptInvitation(studentBId, tId, inv.id),
      acceptInvitation(studentBId, tId, inv.id),
    ]);

    const accepted = accepts.filter(r => r.status === 'fulfilled');
    assert.strictEqual(accepted.length, 1, 'Invitation should only be accepted once');
  });

  it('6. Browser Clock Attack / Permanent Lock', async () => {
    // Admin creates an event that ended 25 hours ago
    const ev = await prisma.event.create({
      data: {
        title: 'Old Event',
        description: 'Ended',
        startTime: new Date(Date.now() - 30 * 3600000), // 30 hours ago
        endTime: new Date(Date.now() - 25 * 3600000), // 25 hours ago
        eventType: EventType.MEETUP,
        registrationType: RegistrationType.TEAM,
        attendanceType: AttendanceType.SINGLE,
        audience: EventAudience.ALL_STUDENTS,
        state: EventState.PUBLISHED,
        maxCapacity: 10,
        metadata: { minimum_team_size: 1, maximum_team_size: 2 },
        createdBy: adminId
      }
    });

    // Student A attempts to create a team in this permanently locked event
    await assert.rejects(createTeam(studentAId, ev.id, 'Too Late Team'), /Event is locked|permanently locked/i);
  });

  it('7. Concurrent Last-Seat Test & Waitlist', async () => {
    // Create event with capacity 2
    const ev = await createEvent(adminId, {
      title: 'Race Event 2',
      start_time: new Date(Date.now() + 100000).toISOString(),
      end_time: new Date(Date.now() + 200000).toISOString(),
      event_type: EventType.MEETUP,
      registration_type: RegistrationType.INDIVIDUAL,
      attendance_type: AttendanceType.SINGLE,
      audience: EventAudience.ALL_STUDENTS,
      max_capacity: 1, // Only 1 seat!
      metadata: {},
      club_ids: [{ club_id: clubAId, is_primary: true }],
    } as any);
    await submitForApproval(clubAdminAId, ev.id);
    await approveEvent(adminId, ev.id);

    // B and D try to register concurrently via individual registration
    const results = await Promise.allSettled([
      registerEvent(studentBId, ev.id),
      registerEvent(studentDId, ev.id)
    ]);
    
    // Check registrations
    const regCount = await prisma.eventRegistration.count({
      where: { eventId: ev.id, registrationStatus: 'REGISTERED' }
    });
    assert.strictEqual(regCount, 1, 'Max capacity of 1 must be strictly enforced');
    
    const waitlistCount = await prisma.eventRegistration.count({
      where: { eventId: ev.id, registrationStatus: 'WAITLISTED' }
    });
    assert.strictEqual(waitlistCount, 1, 'The other should be waitlisted');
  });

  it('8. Academic Audience Bypass', async () => {
    // Event A is restricted to Batch X. 
    // Student C is in Batch Y (see beforeAll setup).
    await assert.rejects(createTeam(studentCId, eventAId, 'C Team'), /AUDIENCE_NOT_ELIGIBLE|not eligible/i);
  });

  it('9. Team Size Race', async () => {
    // Event A has max team size = 3
    // Team A has student D (leader)
    const t = await createTeam(studentDId, eventAId, 'Max Size Race Team');
    const tId = (t as any).team_id;

    // Student D invites E, admin (as student), and clubAdminA (as student)
    const [invE, invCA, invCB] = await Promise.all([
      inviteMember(studentDId, tId, studentEId),
      inviteMember(studentDId, tId, clubAdminAId),
      inviteMember(studentDId, tId, clubAdminBId)
    ]);

    // Concurrently accept 3 invitations (but max size is 3, including leader, so only 2 should succeed)
    const accepts = await Promise.allSettled([
      acceptInvitation(studentEId, tId, invE.id),
      acceptInvitation(clubAdminAId, tId, invCA.id),
      acceptInvitation(clubAdminBId, tId, invCB.id)
    ]);

    const acceptedCount = accepts.filter(r => r.status === 'fulfilled').length;
    assert.strictEqual(acceptedCount, 2, 'Only 2 members can join, capping the team at 3 members total');
    
    const teamMembersCount = await prisma.eventRegistration.count({
      where: { teamId: tId, registrationStatus: 'REGISTERED' }
    });
    assert.strictEqual(teamMembersCount, 3, 'Team size must be capped at 3');
  });
});
