const { PrismaClient } = require('@prisma/client');
const adminPrisma = new PrismaClient({ datasources: { db: { url: "postgresql://postgres:postgres@localhost:5440/nst_events?schema=public" } } });
async function run() {
  const events = await adminPrisma.event.findMany();
  console.log('EVENTS:', events);
  const sessions = await adminPrisma.attendanceSession.findMany();
  console.log('SESSIONS:', sessions);
  process.exit(0);
}
run();
