const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  try {
    const leader = await prisma.user.create({ data: { id: '00000000-0000-0000-0000-000000000001', email: 'test1@test.com', fullName: 'Test', globalRole: 'STUDENT', institutionalId: 'tx1' } });
    const event = await prisma.event.create({ data: { id: '00000000-0000-0000-0000-000000000001', title: 'T', state: 'PUBLISHED', registrationType: 'TEAM', maxCapacity: 10, registrationCount: 0, clubId: '00000000-0000-0000-0000-000000000000' } });
    
    await prisma.$executeRaw`SELECT set_config('app.user_id', ${leader.id}::text, false);`;
    const res = await prisma.$queryRaw`SELECT create_team(${event.id}::uuid, 'Test Team');`;
    console.log(res);
  } catch (e) {
    console.error(e);
  }
}
run();
