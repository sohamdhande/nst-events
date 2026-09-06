import { describe, it, before as beforeAll, after as afterAll } from 'node:test';
import assert from 'node:assert';
import { adminPrisma as prisma } from '../helpers/adminDb';
import { createTeam, inviteMember } from '../../src/modules/teams/teams.service';
import { getPendingTeamInvitations } from '../../src/modules/users/users.service';

describe('Student Invitations Integration Tests', () => {
  let eventId: string;
  let leaderId: string;
  let inviteeId: string;
  let otherStudentId: string;
  let adminId: string;
  let teamId: string;
  let invitationId: string;

  beforeAll(async () => {
    // Cleanup
    await prisma.notificationJob.deleteMany({});
    await prisma.notification.deleteMany({});
    await prisma.eventRegistration.deleteMany({});
    await prisma.teamInvitation.deleteMany({});
    await prisma.team.deleteMany({});
    await prisma.eventClub.deleteMany({});
    await prisma.event.deleteMany({ where: { title: 'Test Invitation Event' } });
    await prisma.club.deleteMany({ where: { name: 'Test Invitation Club' } });
    await prisma.user.deleteMany({ where: { id: { in: ['11111111-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000003', '11111111-0000-0000-0000-000000000004'] } } });
    
    // The previous test deletes specific UUIDs, so we'll create some new ones to avoid collisions
    const leader = await prisma.user.create({ data: { id: '11111111-0000-0000-0000-000000000001', email: 'inv_leader@adypu.edu.in', fullName: 'Inv Leader', globalRole: 'STUDENT', googleSub: 'inv_sub1' } });
    const invitee = await prisma.user.create({ data: { id: '11111111-0000-0000-0000-000000000002', email: 'inv_invitee@adypu.edu.in', fullName: 'Inv Invitee', globalRole: 'STUDENT', googleSub: 'inv_sub2' } });
    const otherStudent = await prisma.user.create({ data: { id: '11111111-0000-0000-0000-000000000003', email: 'inv_other@adypu.edu.in', fullName: 'Inv Other', globalRole: 'STUDENT', googleSub: 'inv_sub3' } });
    const admin = await prisma.user.create({ data: { id: '11111111-0000-0000-0000-000000000004', email: 'inv_admin@nst.com', fullName: 'Inv Admin', globalRole: 'PLATFORM_ADMIN', googleSub: 'inv_sub4' } });

    leaderId = leader.id;
    inviteeId = invitee.id;
    otherStudentId = otherStudent.id;
    adminId = admin.id;

    // Create a club and event
    const club = await prisma.club.create({ data: { name: 'Test Invitation Club' } });
    const event = await prisma.event.create({
      data: {
        title: 'Test Invitation Event',
        description: 'Testing invitations',
        state: 'PUBLISHED',
        registrationType: 'TEAM',
        maxCapacity: 10,
        registrationCount: 0,
        eventClubs: { create: { clubId: club.id, isPrimary: true } },
        metadata: { minimum_team_size: 2, maximum_team_size: 4 },
        startTime: new Date('2027-01-01T00:00:00Z'),
        endTime: new Date('2027-01-02T00:00:00Z'),
        audience: 'ALL_STUDENTS',
        eventType: 'WORKSHOP',
        createdBy: admin.id
      }
    });
    eventId = event.id;

    // Create a team
    const t = await createTeam(leaderId, eventId, 'Invitation Test Team');
    teamId = t.team_id;
  });

  afterAll(async () => {
    // Cleanup
    await prisma.notificationJob.deleteMany({});
    await prisma.notification.deleteMany({});
    await prisma.eventRegistration.deleteMany({});
    await prisma.teamInvitation.deleteMany({});
    await prisma.team.deleteMany({});
    await prisma.eventClub.deleteMany({});
    await prisma.event.deleteMany({ where: { title: 'Test Invitation Event' } });
    await prisma.club.deleteMany({ where: { name: 'Test Invitation Club' } });
    await prisma.user.deleteMany({ where: { id: { in: [leaderId, inviteeId, otherStudentId, adminId] } } });
  });

  it('student with none gets an empty array (not an error)', async () => {
    const invitations = await getPendingTeamInvitations(inviteeId);
    assert.strictEqual(Array.isArray(invitations), true);
    assert.strictEqual(invitations.length, 0);
  });

  it('student with pending invitations sees them', async () => {
    // Leader invites Invitee
    const inv = await inviteMember(leaderId, teamId, inviteeId);
    invitationId = inv.id;

    const invitations = await getPendingTeamInvitations(inviteeId);
    assert.strictEqual(invitations.length, 1);
    
    const responseInv = invitations[0];
    assert.strictEqual(responseInv.invitation_id, invitationId);
    assert.strictEqual(responseInv.status, 'PENDING');
    assert.strictEqual(responseInv.team.team_name, 'Invitation Test Team');
    assert.strictEqual(responseInv.event.event_title, 'Test Invitation Event');
    assert.strictEqual(responseInv.team.leader, 'Inv Leader'); // Shows who invited them
  });

  it('a student cannot see another student\'s invitations', async () => {
    // Other student tries to fetch their invitations
    const otherInvitations = await getPendingTeamInvitations(otherStudentId);
    assert.strictEqual(otherInvitations.length, 0);

    // Verify they can't get the invitee's invite
    const hasInviteeInvite = otherInvitations.some((inv: any) => inv.invitation_id === invitationId);
    assert.strictEqual(hasInviteeInvite, false);
  });
});
