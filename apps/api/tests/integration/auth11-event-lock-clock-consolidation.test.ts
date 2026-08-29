import test from 'node:test';
import * as assert from 'node:assert';
import { before } from 'node:test';
import { adminPrisma as prisma } from '../helpers/adminDb';
import { cancelTeam, removeMember, transferLeadership, cancelInvitation } from '../../src/modules/admin/teams.service';
import { BadRequestError } from '../../src/lib/errors';
import { randomUUID } from 'crypto';

test('AUTH-11 Event Lock Clock Authority Tests', async (t) => {
  const adminId = '00000000-0000-0000-0000-000000000001'; // platform admin
  const leaderId = '00000000-0000-0000-0000-000000000006';
  const memberId = '00000000-0000-0000-0000-000000000007';
  const nonMemberId = '00000000-0000-0000-0000-000000000008';

  before(async () => {

  await prisma.eventRegistration.deleteMany({});
  await prisma.teamInvitation.deleteMany({});
  await prisma.team.deleteMany({});
  await prisma.event.deleteMany({ where: { title: 'Auth11 Event' } });
  
  const setupUser = async (id: string, email: string) => {
    return prisma.user.upsert({
      where: { id },
      update: {},
      create: { id, email, fullName: email, globalRole: id === adminId ? 'PLATFORM_ADMIN' : 'STUDENT', googleSub: email }
    });
  };
  await setupUser(adminId, 'admin@auth11.com');
  await setupUser(leaderId, 'leader@auth11.com');
  await setupUser(memberId, 'member@auth11.com');
  await setupUser(nonMemberId, 'nonmember@auth11.com');

});

  const setupEventAndTeam = async (endTimeMs: number, isLocked: boolean) => {
    const eventId = randomUUID();
    const teamId = randomUUID();

    await prisma.event.create({
      data: {
        id: eventId,
        title: 'Auth11 Event',
        description: 'Test Event',
        startTime: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        endTime: new Date(endTimeMs),
        locationName: 'Test Location',
        eventType: 'WORKSHOP',
        state: 'PUBLISHED',
        registrationType: 'TEAM',
        attendanceType: 'SINGLE',
        audience: 'ALL_STUDENTS',
        isLocked,
        registrationCount: 2,
        createdBy: adminId
      }
    });

    await prisma.team.create({
      data: { id: teamId, eventId, name: `Team ${teamId.substring(0, 5)}`, leaderId, status: 'REGISTERED' }
    });

    await prisma.eventRegistration.createMany({
      data: [
        { id: randomUUID(), eventId, userId: leaderId, teamId, registrationStatus: 'REGISTERED' },
        { id: randomUUID(), eventId, userId: memberId, teamId, registrationStatus: 'REGISTERED' }
      ]
    });

    return { eventId, teamId };
  };

  await t.test('TEST - cancelTeam: unlocked succeeds', async () => {
    const { teamId } = await setupEventAndTeam(Date.now() + 24 * 60 * 60 * 1000, false);
    const res = await cancelTeam(adminId, teamId);
    assert.strictEqual(res.status, 'CANCELLED');
  });

  await t.test('TEST - cancelTeam: explicitly locked is rejected', async () => {
    const { teamId } = await setupEventAndTeam(Date.now() + 24 * 60 * 60 * 1000, true);
    await assert.rejects(cancelTeam(adminId, teamId), { message: 'Event is locked' });
  });

  await t.test('TEST - cancelTeam: exact 24h boundary is rejected (PostgreSQL time)', async () => {
    const dbTimeResult = await prisma.$queryRaw<{ now: Date }[]>`SELECT now() as now`;
    const dbNow = dbTimeResult[0].now.getTime();
    
    // Set end time such that dbNow is EXACTLY at end_time + 24 hours
    // (i.e. end_time = dbNow - 24 hours)
    const { teamId } = await setupEventAndTeam(dbNow - 24 * 60 * 60 * 1000, false);
    await assert.rejects(cancelTeam(adminId, teamId), { message: 'Event is locked' });
  });

  await t.test('TEST - removeMember: unlocked succeeds', async () => {
    const { teamId } = await setupEventAndTeam(Date.now() + 24 * 60 * 60 * 1000, false);
    await assert.doesNotReject(removeMember(adminId, teamId, memberId));
    const count = await prisma.eventRegistration.count({ where: { teamId, userId: memberId, deletedAt: null } });
    assert.strictEqual(count, 0);
  });

  await t.test('TEST - removeMember: locked is rejected', async () => {
    const { teamId } = await setupEventAndTeam(Date.now() + 24 * 60 * 60 * 1000, true);
    await assert.rejects(removeMember(adminId, teamId, memberId), { message: 'Event is locked' });
  });

  await t.test('TEST - transferLeadership: unlocked succeeds', async () => {
    const { teamId } = await setupEventAndTeam(Date.now() + 24 * 60 * 60 * 1000, false);
    const res = await transferLeadership(adminId, teamId, memberId);
    assert.strictEqual(res.leader_id, memberId);
  });

  await t.test('TEST - transferLeadership: locked is rejected', async () => {
    const { teamId } = await setupEventAndTeam(Date.now() + 24 * 60 * 60 * 1000, true);
    await assert.rejects(transferLeadership(adminId, teamId, memberId), { message: 'Event is locked' });
  });

  const setupInvitation = async (teamId: string, eventId: string) => {
    const invId = randomUUID();
    await prisma.teamInvitation.create({
      data: {
        id: invId,
        teamId,
        
        inviteeId: nonMemberId,
        expiresAt: new Date(Date.now() + 10000)
      }
    });
    return invId;
  };

  await t.test('TEST - cancelInvitation: unlocked succeeds', async () => {
    const { teamId, eventId } = await setupEventAndTeam(Date.now() + 24 * 60 * 60 * 1000, false);
    const invId = await setupInvitation(teamId, eventId);
    await assert.doesNotReject(cancelInvitation(adminId, teamId, invId));
    
    const check = await prisma.teamInvitation.findUnique({ where: { id: invId } });
    assert.strictEqual(check?.status, 'CANCELLED');
  });

  await t.test('TEST - cancelInvitation: explicitly locked is rejected', async () => {
    const { teamId, eventId } = await setupEventAndTeam(Date.now() + 24 * 60 * 60 * 1000, true);
    const invId = await setupInvitation(teamId, eventId);
    await assert.rejects(cancelInvitation(adminId, teamId, invId), { message: 'Event is locked' });
  });

  await t.test('TEST - cancelInvitation: boundary before (allowed)', async () => {
    const dbTimeResult = await prisma.$queryRaw<{ now: Date }[]>`SELECT now() as now`;
    const dbNow = dbTimeResult[0].now.getTime();
    
    // end_time = dbNow - 24 hours + 1000ms (so 1 second before the lock)
    const { teamId, eventId } = await setupEventAndTeam(dbNow - 24 * 60 * 60 * 1000 + 1000, false);
    const invId = await setupInvitation(teamId, eventId);
    await assert.doesNotReject(cancelInvitation(adminId, teamId, invId));
  });

  await t.test('TEST - cancelInvitation: exact boundary (rejected)', async () => {
    const dbTimeResult = await prisma.$queryRaw<{ now: Date }[]>`SELECT now() as now`;
    const dbNow = dbTimeResult[0].now.getTime();
    
    // end_time = dbNow - 24 hours (exactly on lock boundary)
    const { teamId, eventId } = await setupEventAndTeam(dbNow - 24 * 60 * 60 * 1000, false);
    const invId = await setupInvitation(teamId, eventId);
    await assert.rejects(cancelInvitation(adminId, teamId, invId), { message: 'Event is locked' });
  });

  await t.test('TEST - cancelInvitation: boundary after (rejected)', async () => {
    const dbTimeResult = await prisma.$queryRaw<{ now: Date }[]>`SELECT now() as now`;
    const dbNow = dbTimeResult[0].now.getTime();
    
    // end_time = dbNow - 24 hours - 1000ms (1 second past the lock)
    const { teamId, eventId } = await setupEventAndTeam(dbNow - 24 * 60 * 60 * 1000 - 1000, false);
    const invId = await setupInvitation(teamId, eventId);
    await assert.rejects(cancelInvitation(adminId, teamId, invId), { message: 'Event is locked' });
  });

  await t.test('TEST - Error contract: SQLSTATE maps correctly to AppError without leaking SQLERRM', async () => {
    const { teamId } = await setupEventAndTeam(Date.now() + 24 * 60 * 60 * 1000, true);
    
    try {
      await cancelTeam(adminId, teamId);
      assert.fail('Should have thrown');
    } catch (err: any) {
      assert.ok(err instanceof BadRequestError, 'Should map to BadRequestError');
      assert.strictEqual(err.message, 'Event is locked', 'Should use semantic message, not SQLERRM');
      assert.strictEqual(err.statusCode, 400);
    }
  });

  await t.test('TEST - Authorization: unauthorized user is rejected', async () => {
    const { teamId } = await setupEventAndTeam(Date.now() + 24 * 60 * 60 * 1000, false);
    // nonMemberId is not an admin, nor leader
    await assert.rejects(cancelTeam(nonMemberId, teamId), { message: 'An unexpected error occurred' });
  });

});
