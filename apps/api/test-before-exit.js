const { PrismaClient } = require('@nst/database');
const prisma = new PrismaClient({ datasources: { db: { url: "postgresql://postgres:postgres@localhost:5440/nst_events?schema=public" } } });

let disconnected = false;
process.on('beforeExit', async () => {
  if (disconnected) return;
  disconnected = true;
  console.log('disconnecting...');
  await prisma.$disconnect();
  console.log('disconnected!');
});

async function run() {
  await prisma.$queryRawUnsafe('SELECT 1');
  console.log('query done');
}
run();
