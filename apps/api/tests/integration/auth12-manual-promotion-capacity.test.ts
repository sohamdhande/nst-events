import { describe, it, before as beforeAll, after as afterAll } from 'node:test';
import assert from 'node:assert';
import { adminPrisma as prisma } from '../helpers/adminDb';
import { manualWaitlistPromotion } from '../../src/modules/admin/teams.service';
import { processWaitlist } from '../../src/modules/admin/events.service';

describe('AUTH-12: Manual Waitlist Promotion Capacity Atomicity', () => {
  let adminId: string;
  let eventId: string;
  let teamAId: string;
  let teamBId: string;
  let user1: string;
  let user2: string;
  let user3: string;
  let user4: string;
  let batchId: string;

  beforeAll(async () => {
    const ts = Date.now();
    // Setup Admin
    const admin = await prisma.user.create({ data: { fullName: 'Admin', email: `admin12_${ts}@t.com`, globalRole: 'PLATFORM_ADMIN', googleSub: `admin12-sub-${ts}` } });
    adminId = admin.id;

    const batch = await prisma.academicBatch.create({ data: { admissionYear: 2022, graduationYear: 2026, program: { create: { name: 'P_' + ts, code: 'P_' + ts } } } });
    batchId = batch.id;

    // Create 4 users
    const users = await Promise.all([1, 2, 3, 4].map(i => prisma.user.create({ data: { fullName: `U${i}`, email: `u${i}_12_${ts}@t.com`, googleSub: `u${i}_12-sub-${ts}` } })));
    [user1, user2, user3, user4] = users.map(u => u.id);

    // Create academic profiles
    await Promise.all(users.map(u => prisma.userAcademicProfile.create({ data: { userId: u.id, batchId, assignmentSource: 'ADMIN_OVERRIDE' } })));

    // Event with capacity 3, Audience: SPECIFIC_BATCHES
    const event = await prisma.event.create({
      data: {
        title: 'Auth12 Test Event',
        registrationType: 'TEAM',
        maxCapacity: 3,
        registrationCount: 0,
        startTime: new Date(Date.now() + 86400000),
        endTime: new Date(Date.now() + 86400000 * 2),
        state: 'PUBLISHED',
        isLocked: false,
        audience: 'SPECIFIC_BATCHES',
        visibility: 'PUBLIC',
        eventType: 'WORKSHOP',
        creator: { connect: { id: adminId } },
        eventAudienceBatches: { create: [{ batchId }] }
      }
    });
    eventId = event.id;

    // Team A (Waitlisted, size 2)
    const teamA = await prisma.team.create({
      data: {
        eventId, name: 'Team A', leaderId: user1, status: 'WAITLISTED',
        eventRegistrations: {
          create: [
            { userId: user1, eventId, registrationStatus: 'WAITLISTED' },
            { userId: user2, eventId, registrationStatus: 'WAITLISTED' }
          ]
        }
      }
    });
    teamAId = teamA.id;

    // Team B (Waitlisted, size 2)
    const teamB = await prisma.team.create({
      data: {
        eventId, name: 'Team B', leaderId: user3, status: 'WAITLISTED',
        eventRegistrations: {
          create: [
            { userId: user3, eventId, registrationStatus: 'WAITLISTED' },
            { userId: user4, eventId, registrationStatus: 'WAITLISTED' }
          ]
        }
      }
    });
    teamBId = teamB.id;
  });

  afterAll(async () => {
    // Cleanup
    await prisma.notification.deleteMany({ where: { userId: { in: [user1, user2, user3, user4] } } });
    await prisma.auditLog.deleteMany({ where: { actorId: adminId } });
    await prisma.eventRegistration.deleteMany({ where: { eventId } });
    await prisma.team.deleteMany({ where: { eventId } });
    await prisma.eventAudienceBatch.deleteMany({ where: { eventId } });
    await prisma.event.delete({ where: { id: eventId } });
    await prisma.userAcademicProfile.deleteMany({ where: { userId: { in: [user1, user2, user3, user4] } } });
    await prisma.user.deleteMany({ where: { id: { in: [adminId, user1, user2, user3, user4] } } });
    await prisma.academicBatch.delete({ where: { id: batchId } });
  });

  it('Concurrent manual promotions serialize and prevent capacity overflow', async () => {
    const results = await Promise.allSettled([
      manualWaitlistPromotion(adminId, teamAId),
      manualWaitlistPromotion(adminId, teamBId)
    ]);

    const fulfilled = results.filter(r => r.status === 'fulfilled');
    const rejected = results.filter(r => r.status === 'rejected') as PromiseRejectedResult[];

    // Exactly one should succeed
    assert.strictEqual(fulfilled.length, 1);
    assert.strictEqual(rejected.length, 1);
    assert.ok(rejected[0].reason.message.includes('Event capacity is full'));

    const event = await prisma.event.findUnique({ where: { id: eventId } });
    assert.strictEqual(event!.registrationCount, 2);

    const teamA = await prisma.team.findUnique({ where: { id: teamAId } });
    const teamB = await prisma.team.findUnique({ where: { id: teamBId } });

    assert.notStrictEqual(teamA!.status, teamB!.status);
    assert.ok(['REGISTERED', 'WAITLISTED'].includes(teamA!.status));
    assert.ok(['REGISTERED', 'WAITLISTED'].includes(teamB!.status));
  });

  it('Promotion fails if insufficient capacity (repeated on exact full)', async () => {
    // Current registrationCount is 2. Waitlisted team needs 2. Capacity is 3. Should fail.
    const remainingTeamId = (await prisma.team.findUnique({ where: { id: teamAId } }))!.status === 'WAITLISTED' ? teamAId : teamBId;

    await assert.rejects(
      manualWaitlistPromotion(adminId, remainingTeamId),
      (err: any) => err.message.includes('Event capacity is full')
    );
  });

  it('Promotion respects 24-hour SQL lock', async () => {
    // Make capacity unlimited
    await prisma.event.update({ where: { id: eventId }, data: { maxCapacity: null } });

    // Move end time to > 24 hours ago
    await prisma.event.update({ where: { id: eventId }, data: { endTime: new Date(Date.now() - 86400000 - 1000) } });
    
    const remainingTeamId = (await prisma.team.findUnique({ where: { id: teamAId } }))!.status === 'WAITLISTED' ? teamAId : teamBId;

    await assert.rejects(
      manualWaitlistPromotion(adminId, remainingTeamId),
      (err: any) => err.message.includes('Event is locked')
    );

    // Revert time
    await prisma.event.update({ where: { id: eventId }, data: { endTime: new Date(Date.now() + 86400000) } });
  });

  it('Promotion handles ATTENDANCE-09 snapshots accurately', async () => {
    const registeredTeam = (await prisma.team.findUnique({ where: { id: teamAId } }))!.status === 'REGISTERED' ? teamAId : teamBId;

    const regs = await prisma.eventRegistration.findMany({ where: { teamId: registeredTeam } });
    for (const reg of regs) {
      assert.strictEqual(reg.registrationStatus, 'REGISTERED');
      assert.strictEqual(reg.eligibilityScopeSnapshot, 'SPECIFIC_BATCHES');
      assert.strictEqual(reg.academicBatchIdSnapshot, batchId); // Extracted dynamically!
    }
  });
});
