import { describe, it, before as beforeAll, after as afterAll } from 'node:test';
import assert from 'node:assert';
import { adminPrisma as prisma } from '../helpers/adminDb';
import { createTeam, inviteMember, acceptInvitation, leaveTeam, joinTeam } from '../../src/modules/teams/teams.service';
import { manualWaitlistPromotion, cancelTeam, transferLeadership, removeMember } from '../../src/modules/admin/teams.service';

describe('Team Lifecycle Integration Tests', () => {
  let eventId: string;
  let leaderId: string;
  let member1Id: string;
  let member2Id: string;
  let adminId: string;
  let teamId: string;
  let invitationId: string;

  beforeAll(async () => {
    // Cleanup first just in case
    await prisma.eventRegistration.deleteMany({});
    await prisma.teamInvitation.deleteMany({});
    await prisma.team.deleteMany({});
    await prisma.notificationJob.deleteMany({});
    await prisma.notification.deleteMany({});
    await prisma.eventClub.deleteMany({});
    await prisma.event.deleteMany({ where: { id: '00000000-0000-0000-0000-000000000005' } });
    await prisma.club.deleteMany({ where: { id: '00000000-0000-0000-0000-000000000000' } });
    await prisma.user.deleteMany({ where: { id: { in: ['00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000004'] } } });

    // Create users
    const leader = await prisma.user.create({ data: { id: '00000000-0000-0000-0000-000000000001', email: 'leader@adypu.edu.in', fullName: 'Leader', globalRole: "STUDENT", googleSub: "sub1" } });
    const member1 = await prisma.user.create({ data: { id: '00000000-0000-0000-0000-000000000002', email: 'member1@adypu.edu.in', fullName: 'Member 1', globalRole: "STUDENT", googleSub: "sub2" } });
    const member2 = await prisma.user.create({ data: { id: '00000000-0000-0000-0000-000000000003', email: 'member2@adypu.edu.in', fullName: 'Member 2', globalRole: "STUDENT", googleSub: "sub3" } });
    const admin = await prisma.user.create({ data: { id: '00000000-0000-0000-0000-000000000004', email: 'admin@nst.com', fullName: 'Admin', globalRole: "PLATFORM_ADMIN", googleSub: "sub4" } });

    leaderId = leader.id;
    member1Id = member1.id;
    member2Id = member2.id;
    adminId = admin.id;

    // Create a club
    await prisma.club.create({
      data: {
        id: '00000000-0000-0000-0000-000000000000',
        name: 'Test Club',
      }
    });

    // Create a TEAM event with min size 2, max size 3, capacity 4
    const event = await prisma.event.create({
      data: {
        id: '00000000-0000-0000-0000-000000000005',
        title: 'Team Event',
        description: 'Integration test event',
        state: 'PUBLISHED',
        registrationType: 'TEAM',
        maxCapacity: 4,
        registrationCount: 0,
        eventClubs: {
          create: {
            clubId: '00000000-0000-0000-0000-000000000000',
            isPrimary: true
          }
        },
        metadata: {
          minimum_team_size: 2,
          maximum_team_size: 3
        },
        startTime: new Date('2027-01-01T00:00:00Z'),
        endTime: new Date('2027-01-02T00:00:00Z'),
        audience: 'ALL_STUDENTS',
        eventType: 'WORKSHOP',
        createdBy: admin.id
      }
    });
    eventId = event.id;
  });

  afterAll(async () => {
    // Cleanup
    await prisma.eventRegistration.deleteMany({});
    await prisma.teamInvitation.deleteMany({});
    await prisma.team.deleteMany({});
    await prisma.notificationJob.deleteMany({});
    await prisma.notification.deleteMany({});
    await prisma.eventClub.deleteMany({});
    await prisma.event.deleteMany({ where: { id: eventId } });
    await prisma.club.deleteMany({ where: { id: '00000000-0000-0000-0000-000000000000' } });
    await prisma.user.deleteMany({ where: { id: { in: [leaderId, member1Id, member2Id, adminId] } } });
  });

  it('should create a FORMING team and not consume capacity', async () => {
    const res = await createTeam(leaderId, eventId, 'Test Team');
    assert.ok(res.team_id);
    assert.strictEqual(res.status, 'FORMING');
    teamId = res.team_id;

    const event = await prisma.event.findUnique({ where: { id: eventId } });
    assert.strictEqual(event?.registrationCount, 0); // FORMING doesn't count
  });

  it('should invite a member and leave team as FORMING', async () => {
    const inv = await inviteMember(leaderId, teamId, member1Id);
    assert.ok(inv.id);
    invitationId = inv.id;

    const team = await prisma.team.findUnique({ where: { id: teamId } });
    assert.strictEqual(team?.status, 'FORMING');
  });

  it('should accept invitation and register team since it meets minimum size (2)', async () => {
    const res = await acceptInvitation(member1Id, teamId, invitationId);
    assert.strictEqual(res.status, 'REGISTERED');

    const team = await prisma.team.findUnique({ where: { id: teamId } });
    assert.strictEqual(team?.status, 'REGISTERED');

    const event = await prisma.event.findUnique({ where: { id: eventId } });
    assert.strictEqual(event?.registrationCount, 2); // Now it consumed capacity
  });

  it('should join team via joinTeam (bypassing invite for test sake) and respect max capacity', async () => {
    // Wait, joinTeam doesn't check invitation, so we can simulate member2 joining
    const res = await joinTeam(member2Id, teamId);
    assert.strictEqual(res.status, 'REGISTERED');

    const event = await prisma.event.findUnique({ where: { id: eventId } });
    assert.strictEqual(event?.registrationCount, 3); // 3 members total
  });

  it('should prevent leader from leaving directly', async () => {
    await assert.rejects(leaveTeam(leaderId, teamId), { message: /LEADER_CANNOT_LEAVE/ });
  });

  it('should allow admin to transfer leadership', async () => {
    await transferLeadership(adminId, teamId, member1Id);
    const team = await prisma.team.findUnique({ where: { id: teamId } });
    assert.strictEqual(team?.leaderId, member1Id);
  });

  it('should remove member (old leader) and not change REGISTERED status immediately (grace period conceptually)', async () => {
    // Admin removes the old leader (now a normal member)
    await removeMember(adminId, teamId, leaderId);
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    assert.strictEqual(event?.registrationCount, 2); // Reduced by 1

    const team = await prisma.team.findUnique({ where: { id: teamId } });
    assert.strictEqual(team?.status, 'REGISTERED'); // Still registered even though below min size conceptually (lazy cleanup handles cancelling later)
  });

  it('should cancel team by admin', async () => {
    await cancelTeam(adminId, teamId);
    const team = await prisma.team.findUnique({ where: { id: teamId } });
    assert.strictEqual(team?.status, 'CANCELLED');

    const event = await prisma.event.findUnique({ where: { id: eventId } });
    assert.strictEqual(event?.registrationCount, 0); // Capacity released completely
  });
});
