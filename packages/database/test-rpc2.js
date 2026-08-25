const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  try {
    const leader = await prisma.user.findFirst();
    const event = await prisma.event.findFirst({ where: { registrationType: 'TEAM' } });
    if (!event || !leader) return;
    
    await prisma.$executeRaw`SELECT set_config('app.user_id', ${leader.id}::text, false);`;
    const res = await prisma.$queryRaw`SELECT create_team(${event.id}::uuid, 'Test Team');`;
    console.log(res);
  } catch (e) {
    console.error(e);
  }
}
run();
