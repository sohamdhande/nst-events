import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function run() {
  const regs = await prisma.eventRegistration.findMany({ include: { event: true } });
  regs.forEach(reg => {
    console.log(`Reg ${reg.id} - User ${reg.userId}`);
    console.log(`  Event: ${reg.event.title}`);
    console.log(`  Start: ${reg.event.startTime}`);
    console.log(`  End: ${reg.event.endTime}`);
    console.log(`  Status: ${reg.registrationStatus}`);
  });
}
run();
