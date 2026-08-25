import { describe, it, before as beforeAll, after as afterAll } from 'node:test';
import assert from 'node:assert';
import { adminPrisma as prisma } from '../helpers/adminDb';
import { listTeams } from '../../src/modules/teams/teams.service';

describe('Team Attention & Below Minimum Signal', () => {
  let eventId: string;
  let leader1Id: string;
  let leader2Id: string;
  let leader3Id: string;
  let leader4Id: string;
  let leader5Id: string;
  let member1Id: string;
  let member2Id: string;
  let member3Id: string;
  
  let team1Id: string; // FORMING
  let team2Id: string; // WAITLISTED
  let team3Id: string; // CANCELLED
  let team4Id: string; // REGISTERED meeting minimum (2)
  let team5Id: string; // REGISTERED below minimum (1)

  beforeAll(async () => {
    await prisma.eventRegistration.deleteMany({});
    await prisma.team.deleteMany({});
    await prisma.event.deleteMany({ where: { id: '00000000-0000-0000-0000-000000000040' } });
    await prisma.user.deleteMany({
      where: {
        id: { in: ['00000000-0000-0000-0000-000000000041', '00000000-0000-0000-0000-000000000042', '00000000-0000-0000-0000-000000000043', '00000000-0000-0000-0000-000000000044', '00000000-0000-0000-0000-000000000045', '00000000-0000-0000-0000-000000000046', '00000000-0000-0000-0000-000000000047', '00000000-0000-0000-0000-000000000048'] }
      }
    });

    const createU = async (id: string, name: string) => 
      prisma.user.create({ data: { id, email: `${name}@nst.com`, fullName: name, globalRole: 'STUDENT', googleSub: `sub${id}` } });

    const l1 = await prisma.user.create({ data: { id: '00000000-0000-0000-0000-000000000041', email: 'L1@nst.com', fullName: 'L1', globalRole: 'PLATFORM_ADMIN', googleSub: 'sub00000000-0000-0000-0000-000000000041' } });
    const l2 = await createU('00000000-0000-0000-0000-000000000042', 'L2');
    const l3 = await createU('00000000-0000-0000-0000-000000000043', 'L3');
    const l4 = await createU('00000000-0000-0000-0000-000000000044', 'L4');
    const l5 = await createU('00000000-0000-0000-0000-000000000045', 'L5');
    const m1 = await createU('00000000-0000-0000-0000-000000000046', 'M1');
    const m2 = await createU('00000000-0000-0000-0000-000000000047', 'M2');
    const m3 = await createU('00000000-0000-0000-0000-000000000048', 'M3');

    leader1Id = l1.id; leader2Id = l2.id; leader3Id = l3.id; leader4Id = l4.id; leader5Id = l5.id;
    member1Id = m1.id; member2Id = m2.id; member3Id = m3.id;

    const club = await prisma.club.create({ data: { id: '00000000-0000-0000-0000-000000000049', name: 'Test Club' } });
    await prisma.clubMembership.create({ data: { userId: leader1Id, clubId: club.id, role: 'CLUB_ADMIN' } });
    for (const uid of [leader2Id, leader3Id, leader4Id, leader5Id, member1Id, member2Id, member3Id]) {
      await prisma.clubMembership.create({ data: { userId: uid, clubId: club.id, role: 'MEMBER' } });
    }

    const event = await prisma.event.create({
      data: {
        id: '00000000-0000-0000-0000-000000000040',
        title: 'Attention Event',
        state: 'PUBLISHED',
        registrationType: 'TEAM',
        maxCapacity: 100,
        metadata: { minimum_team_size: 2, maximum_team_size: 4 },
        startTime: new Date(Date.now() - 3600000),
        endTime: new Date(Date.now() + 3600000),
        audience: 'ALL_STUDENTS',
        eventType: 'OTHER',
        createdBy: leader1Id
      }
    });
    eventId = event.id;
    await prisma.eventClub.create({ data: { eventId, clubId: club.id, isPrimary: true } });

    // Create Teams
    const t1 = await prisma.team.create({ data: { eventId, leaderId: leader1Id, name: 'Team 1', status: 'FORMING' } });
    const t2 = await prisma.team.create({ data: { eventId, leaderId: leader2Id, name: 'Team 2', status: 'WAITLISTED' } });
    const t3 = await prisma.team.create({ data: { eventId, leaderId: leader3Id, name: 'Team 3', status: 'CANCELLED' } });
    const t4 = await prisma.team.create({ data: { eventId, leaderId: leader4Id, name: 'Team 4', status: 'REGISTERED' } });
    const t5 = await prisma.team.create({ data: { eventId, leaderId: leader5Id, name: 'Team 5', status: 'REGISTERED' } });

    team1Id = t1.id; team2Id = t2.id; team3Id = t3.id; team4Id = t4.id; team5Id = t5.id;

    // Registrations
    await prisma.eventRegistration.create({ data: { eventId, teamId: team1Id, userId: leader1Id, registrationStatus: 'REGISTERED' } });
    
    await prisma.eventRegistration.create({ data: { eventId, teamId: team2Id, userId: leader2Id, registrationStatus: 'WAITLISTED' } });
    
    await prisma.eventRegistration.create({ data: { eventId, teamId: team3Id, userId: leader3Id, registrationStatus: 'CANCELLED' } });
    
    // Team 4 meets minimum (2 members)
    await prisma.eventRegistration.create({ data: { eventId, teamId: team4Id, userId: leader4Id, registrationStatus: 'REGISTERED' } });
    await prisma.eventRegistration.create({ data: { eventId, teamId: team4Id, userId: member1Id, registrationStatus: 'REGISTERED' } });
    
    // Team 5 below minimum (1 member)
    await prisma.eventRegistration.create({ data: { eventId, teamId: team5Id, userId: leader5Id, registrationStatus: 'REGISTERED' } });
    
    // Team 5 also has a deleted member (should be ignored)
    await prisma.eventRegistration.create({ data: { eventId, teamId: team5Id, userId: member2Id, registrationStatus: 'REGISTERED', deletedAt: new Date() } });

  });

  afterAll(async () => {
    await prisma.eventRegistration.deleteMany({});
    await prisma.team.deleteMany({});
    await prisma.eventClub.deleteMany({});
    await prisma.event.deleteMany({ where: { id: eventId } });
    await prisma.clubMembership.deleteMany({});
    await prisma.club.deleteMany({ where: { id: '00000000-0000-0000-0000-000000000049' } });
    await prisma.user.deleteMany({
      where: { id: { in: [leader1Id, leader2Id, leader3Id, leader4Id, leader5Id, member1Id, member2Id, member3Id] } }
    });
  });

  it('Evaluates below_minimum correctly for all teams in single efficient query', async () => {
    const dbTeams = await prisma.team.findMany({ where: { eventId } });
    const res = await listTeams(leader1Id, eventId);
    
    
    const t1 = res.data.find(t => t.id === team1Id);
    const t2 = res.data.find(t => t.id === team2Id);
    const t3 = res.data.find(t => t.id === team3Id);
    const t4 = res.data.find(t => t.id === team4Id);
    const t5 = res.data.find(t => t.id === team5Id);

    // FORMING -> false
    assert.strictEqual(t1?.below_minimum, false);
    // WAITLISTED -> false
    assert.strictEqual(t2?.below_minimum, false);
    // CANCELLED -> false
    assert.strictEqual(t3?.below_minimum, false);
    
    // REGISTERED meeting minimum (2 members active, min is 2)
    assert.strictEqual(t4?.below_minimum, false);
    
    // REGISTERED below minimum (1 member active, 1 deleted member, min is 2)
    assert.strictEqual(t5?.below_minimum, true);
    assert.strictEqual(t5?.member_count, 1);
  });
});
