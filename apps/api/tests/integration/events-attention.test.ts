import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { adminPrisma as prisma } from '../helpers/adminDb';
import { listEvents, getEventById } from '../../src/modules/events/events.service';

describe('Event Attention Aggregate - below_minimum_team_count', () => {
  let adminUserId: string;
  let testEventId: string;
  let testClubId: string;
  let users: any[] = [];

  before(async () => {
    const adminUser = await prisma.user.create({
      data: {
        email: 'test_admin_attention@example.com',
        fullName: 'Admin User',
        globalRole: 'PLATFORM_ADMIN',
        googleSub: 'mock-admin-sub',
      },
    });
    adminUserId = adminUser.id;

    // Create multiple users for team registrations
    for (let i = 0; i < 20; i++) {
      const user = await prisma.user.create({
        data: {
          email: `test_team_user_${i}@example.com`,
          fullName: `Test User ${i}`,
          globalRole: 'STUDENT',
          googleSub: `mock-sub-${i}`,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
      users.push(user);
    }

    const club = await prisma.club.create({
      data: {
        name: 'Test Aggregate Club',
        description: 'Testing team aggregates',
        status: 'ACTIVE',
      },
    });
    testClubId = club.id;

    // Create Event with minimum_team_size = 3
    const event = await prisma.event.create({
      data: {
        title: 'Team Attention Event',
        description: 'Event to test below_minimum_team_count',
        startTime: new Date(Date.now() + 86400000),
        endTime: new Date(Date.now() + 172800000),
        eventType: 'COMPETITION',
        visibility: 'PUBLIC',
        registrationType: 'TEAM',
        attendanceType: 'SINGLE',
        createdBy: users[0].id,
        audience: 'ALL_STUDENTS',
        metadata: {
          minimum_team_size: 3,
        },
        eventClubs: {
          create: [{ clubId: testClubId, isPrimary: true }],
        },
      },
    });
    testEventId = event.id;
  });

  after(async () => {
    await prisma.eventRegistration.deleteMany({ where: { eventId: testEventId } });
    await prisma.team.deleteMany({ where: { eventId: testEventId } });
    await prisma.eventClub.deleteMany({ where: { eventId: testEventId } });
    await prisma.event.deleteMany({ where: { id: testEventId } });
    await prisma.club.deleteMany({ where: { id: testClubId } });
    await prisma.user.deleteMany({ where: { email: { in: ['test_admin_attention@example.com', ...users.map(u => u.email)] } } });
  });

  const createTeam = async (name: string, status: any, memberCount: number, userStartIndex: number) => {
    const team = await prisma.team.create({
      data: {
        eventId: testEventId,
        name,
        leaderId: users[userStartIndex].id,
        status,
      },
    });

    for (let i = 0; i < memberCount; i++) {
      const userIndex = userStartIndex + i;
      await prisma.eventRegistration.create({
        data: {
          eventId: testEventId,
          userId: users[userIndex].id,
          teamId: team.id,
          registrationStatus: 'REGISTERED',
          participationRole: 'ATTENDEE',
        },
      });
    }
    return team;
  };

  it('initially has 0 below_minimum_team_count', async () => {
    const res = await listEvents(adminUserId, { limit: 10 });
    const event = res.data.find((e: any) => e.id === testEventId);
    assert.ok(event);
    assert.strictEqual(event.below_minimum_team_count, 0);
  });

  it('ignores FORMING teams', async () => {
    await createTeam('Forming Team', 'FORMING', 1, 0);

    const res = await listEvents(adminUserId, { limit: 10 });
    const event = res.data.find((e: any) => e.id === testEventId);
    assert.strictEqual(event.below_minimum_team_count, 0);
  });

  it('counts REGISTERED teams below minimum', async () => {
    // minimum is 3, memberCount is 2
    await createTeam('Understaffed Team', 'REGISTERED', 2, 1);

    const res = await listEvents(adminUserId, { limit: 10 });
    const event = res.data.find((e: any) => e.id === testEventId);
    assert.strictEqual(event.below_minimum_team_count, 1);

    // Also check getEventById
    const detailRes = await getEventById(adminUserId, testEventId);
    assert.strictEqual(detailRes.below_minimum_team_count, 1);
  });

  it('ignores REGISTERED teams that meet the minimum', async () => {
    // minimum is 3, memberCount is 3
    await createTeam('Valid Team', 'REGISTERED', 3, 3);

    const res = await listEvents(adminUserId, { limit: 10 });
    const event = res.data.find((e: any) => e.id === testEventId);
    // Still 1 because of the previous understaffed team
    assert.strictEqual(event.below_minimum_team_count, 1);
  });

  it('ignores soft-deleted event registrations', async () => {
    // Create team with 3 members, then soft-delete one
    const team = await createTeam('Deleted Member Team', 'REGISTERED', 3, 6);

    const reg = await prisma.eventRegistration.findFirst({
      where: { teamId: team.id, participationRole: 'ATTENDEE' },
    });
    
    await prisma.eventRegistration.update({
      where: { id: reg!.id },
      data: { deletedAt: new Date() },
    });

    const res = await listEvents(adminUserId, { limit: 10 });
    const event = res.data.find((e: any) => e.id === testEventId);
    // Now there are 2 teams understaffed
    assert.strictEqual(event.below_minimum_team_count, 2);
  });

  it('ignores WAITLISTED and CANCELLED teams', async () => {
    await createTeam('Waitlist Team', 'WAITLISTED', 1, 9);
    await createTeam('Cancelled Team', 'CANCELLED', 1, 10);

    const res = await listEvents(adminUserId, { limit: 10 });
    const event = res.data.find((e: any) => e.id === testEventId);
    assert.strictEqual(event.below_minimum_team_count, 2);
  });
});
