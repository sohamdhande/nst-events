const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const adminPrisma = new PrismaClient();
  const session = await adminPrisma.attendanceSession.findFirst({ orderBy: { createdAt: 'desc' }, include: { event: true } });
  console.log('Session via adminPrisma:', JSON.stringify(session, null, 2));

  const session2 = await prisma.attendanceSession.findUnique({ where: { id: session.id } });
  console.log('Session via prisma:', session2 ? 'FOUND' : 'NOT FOUND');
  
  process.exit(0);
}
run();
