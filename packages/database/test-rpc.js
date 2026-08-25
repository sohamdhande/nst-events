const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  try {
    const res = await prisma.$queryRaw`SELECT create_team('00000000-0000-0000-0000-000000000000'::uuid, 'Test Team');`;
    console.log(res);
  } catch (e) {
    console.error(e);
  }
}
run();
