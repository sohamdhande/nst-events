import { describe, it, before as beforeAll, after as afterAll } from 'node:test';
import assert from 'node:assert';
import { adminPrisma as prisma } from '../helpers/adminDb';
import { createEvent, updateEvent, getEventById, submitForApproval, approveEvent, lockEvent } from '../../src/modules/events/events.service';
import { createTeam, inviteMember, acceptInvitation, joinTeam, leaveTeam } from '../../src/modules/teams/teams.service';
import { createSession } from '../../src/modules/events/attendance.service';
import { AttendanceType, EventAudience, EventState, EventType, EventVisibility, RegistrationType, AssignmentSource } from '@nst/database';

describe('Phase 19 E2E Audit', () => {
  let adminId: string;
  let studentAId: string;
  let studentBId: string;
  let studentCId: string;
  let studentDId: string;
  let studentEId: string;
  let studentFId: string;

  let clubId: string;
  let programXId: string;
  let batchXId: string;
  let batchYId: string;

  let eventId: string;
  let teamId: string;
  let sessionId: string;

  beforeAll(async () => {
    // Cleanup first to avoid unique constraint failures
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
    await prisma.user.deleteMany({ where: { email: { contains: 'e2e' } } });

    // Seed Data
    const admin = await prisma.user.create({ data: { email: 'admin_e2e@adypu.edu.in', fullName: 'Admin E2E', globalRole: 'PLATFORM_ADMIN', googleSub: 'sub_admin_e2e' } });
    adminId = admin.id;

    const studentA = await prisma.user.create({ data: { email: 'studentA_e2e@adypu.edu.in', fullName: 'Student A', globalRole: 'STUDENT', googleSub: 'sub_a_e2e' } });
    studentAId = studentA.id;
    const studentB = await prisma.user.create({ data: { email: 'studentB_e2e@adypu.edu.in', fullName: 'Student B', globalRole: 'STUDENT', googleSub: 'sub_b_e2e' } });
    studentBId = studentB.id;
    const studentC = await prisma.user.create({ data: { email: 'studentC_e2e@adypu.edu.in', fullName: 'Student C', globalRole: 'STUDENT', googleSub: 'sub_c_e2e' } });
    studentCId = studentC.id;
    const studentD = await prisma.user.create({ data: { email: 'studentD_e2e@adypu.edu.in', fullName: 'Student D', globalRole: 'STUDENT', googleSub: 'sub_d_e2e' } });
    studentDId = studentD.id;
    const studentE = await prisma.user.create({ data: { email: 'studentE_e2e@adypu.edu.in', fullName: 'Student E', globalRole: 'STUDENT', googleSub: 'sub_e_e2e' } });
    studentEId = studentE.id;
    const studentF = await prisma.user.create({ data: { email: 'studentF_e2e@adypu.edu.in', fullName: 'Student F', globalRole: 'STUDENT', googleSub: 'sub_f_e2e' } });
    studentFId = studentF.id;

    const club = await prisma.club.create({ data: { name: 'E2E Club', status: 'ACTIVE' } });
    clubId = club.id;

    const programX = await prisma.academicProgram.create({ data: { id: '00000000-0000-0000-0000-000000000010', name: 'B.Tech CSE E2E', code: 'CSE_E2E' } });
    programXId = programX.id;

    const batchX = await prisma.academicBatch.create({ data: { programId: programXId, admissionYear: 2025, graduationYear: 2029 } });
    batchXId = batchX.id;
    const batchY = await prisma.academicBatch.create({ data: { programId: programXId, admissionYear: 2026, graduationYear: 2030 } });
    batchYId = batchY.id;

    await prisma.userAcademicProfile.create({ data: { userId: studentAId, batchId: batchXId, assignmentSource: AssignmentSource.ADMIN_OVERRIDE } });
    await prisma.userAcademicProfile.create({ data: { userId: studentCId, batchId: batchXId, assignmentSource: AssignmentSource.ADMIN_OVERRIDE } });
    await prisma.userAcademicProfile.create({ data: { userId: studentDId, batchId: batchXId, assignmentSource: AssignmentSource.ADMIN_OVERRIDE } });
    await prisma.userAcademicProfile.create({ data: { userId: studentEId, batchId: batchXId, assignmentSource: AssignmentSource.ADMIN_OVERRIDE } });
    await prisma.userAcademicProfile.create({ data: { userId: studentFId, batchId: batchXId, assignmentSource: AssignmentSource.ADMIN_OVERRIDE } });

    await prisma.userAcademicProfile.create({ data: { userId: studentBId, batchId: batchYId, assignmentSource: AssignmentSource.ADMIN_OVERRIDE } });
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
    await prisma.user.deleteMany({ where: { email: { contains: 'e2e' } } });
  });

  it('Executes the full E2E lifecycle', async () => {
    // 1. Event Creation & Configuration (Admin)
    const event = await createEvent(adminId, {
      title: 'E2E Audit Event',
      start_time: new Date(Date.now() + 100000).toISOString(),
      end_time: new Date(Date.now() + 200000).toISOString(),
      event_type: EventType.HACKATHON,
      registration_type: RegistrationType.TEAM,
      attendance_type: AttendanceType.SINGLE,
      audience: EventAudience.SPECIFIC_BATCHES,
      audience_batch_ids: [batchXId],
      max_capacity: 10,
      metadata: { minimum_team_size: 2, maximum_team_size: 4 },
      club_ids: [{ club_id: clubId, is_primary: true }],
    } as any);

    eventId = event.id;
    assert.strictEqual(event.state, EventState.DRAFT);
    assert.strictEqual(event.registrationType, RegistrationType.TEAM);
    assert.strictEqual(event.audience, EventAudience.SPECIFIC_BATCHES);

    const fetched1 = await getEventById(adminId, eventId);
    assert.strictEqual(fetched1.audienceBatchIds?.length, 1);
    assert.strictEqual(fetched1.audienceBatchIds?.[0], batchXId);
    assert.strictEqual((fetched1.metadata as any)?.minimum_team_size, 2);

    // 2. Draft Round Trip
    await updateEvent(adminId, eventId, {
      metadata: { minimum_team_size: 2, maximum_team_size: 5, extra: 'data' }
    } as any);
    const fetched2 = await getEventById(adminId, eventId);
    assert.strictEqual((fetched2.metadata as any)?.maximum_team_size, 5);
    assert.strictEqual((fetched2.metadata as any)?.extra, 'data');
    assert.strictEqual(fetched2.audienceBatchIds?.[0], batchXId);

    // 3. Lifecycle (Submit -> Approve -> Published)
    await submitForApproval(adminId, eventId);
    const pending = await getEventById(adminId, eventId);
    assert.strictEqual(pending.state, EventState.PENDING_APPROVAL);

    await approveEvent(adminId, eventId);
    const pub = await getEventById(adminId, eventId);
    assert.strictEqual(pub.state, EventState.PUBLISHED);

    // 4. Audience Visibility & Registration Eligibility
    // Student B (Batch Y) tries to create team -> Fails
    await assert.rejects(createTeam(studentBId, eventId, 'Team B'), /AUDIENCE_NOT_ELIGIBLE/);

    // Student A (Batch X) creates team -> Success
    const team = await createTeam(studentAId, eventId, 'Team A');
    teamId = (team as any).team_id;
    assert.strictEqual(team.status, 'FORMING');

    // Capacity should be 0 since it is FORMING
    const ev1 = await getEventById(adminId, eventId);
    assert.strictEqual(ev1.registrationCount, 0);

    // 5. Team Invitations
    // Student A invites Student C
    const inv = await inviteMember(studentAId, teamId, studentCId);
    assert.strictEqual(inv.status, 'PENDING');

    // Student A invites Student B (Batch Y) -> Fails
    await assert.rejects(inviteMember(studentAId, teamId, studentBId), /AUDIENCE_NOT_ELIGIBLE/);

    // 6. Invitation Acceptance & Team Registration
    const invC = await prisma.teamInvitation.findFirst({ where: { teamId, inviteeId: studentCId } });
    assert.ok(invC);
    
    await acceptInvitation(studentCId, teamId, invC!.id);
    const teamAfterC = await prisma.team.findUnique({ where: { id: teamId } });
    assert.strictEqual(teamAfterC?.status, 'REGISTERED');

    // Capacity should be 2 now
    const ev2 = await getEventById(adminId, eventId);
    assert.strictEqual(ev2.registrationCount, 2);

    // 7. Team Maximum
    const invD = await inviteMember(studentAId, teamId, studentDId);
    await acceptInvitation(studentDId, teamId, invD.id);

    const invE = await inviteMember(studentAId, teamId, studentEId);
    await acceptInvitation(studentEId, teamId, invE.id);
    
    // Team should have 4 members now (max was updated to 5 in draft round trip)
    const teamAfterE = await prisma.team.findUnique({ where: { id: teamId }, include: { eventRegistrations: true } });
    assert.strictEqual(teamAfterE?.eventRegistrations.length, 4);

    // 5th member joins
    const invF = await inviteMember(studentAId, teamId, studentFId);
    await acceptInvitation(studentFId, teamId, invF.id);

    const teamAfterF = await prisma.team.findUnique({ where: { id: teamId }, include: { eventRegistrations: true } });
    assert.strictEqual(teamAfterF?.eventRegistrations.length, 5);

    // 8. Event Lock
    await lockEvent(adminId, eventId);
    
    // Attempting team mutations should fail
    await assert.rejects(leaveTeam(studentCId, teamId), /Event is locked/);
    
    // Check if event is locked
    const ev3 = await getEventById(adminId, eventId);
    assert.strictEqual(ev3.isLocked, true);
  });
});
