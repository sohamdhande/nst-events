import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function run() {
  const events = await prisma.event.findMany({ select: { id: true, title: true, startTime: true, endTime: true, state: true } });
  console.log("Events:", events);
}
run();
