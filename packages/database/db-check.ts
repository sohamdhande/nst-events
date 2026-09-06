import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function run() {
  const users = await prisma.user.findMany({ take: 5 });
  console.log("Users:", users.map(u => ({ id: u.id, email: u.email, role: u.globalRole })));
  
  const regs = await prisma.eventRegistration.findMany({ include: { event: true } });
  console.log("Total Registrations in DB:", regs.length);
  if (regs.length > 0) {
    console.log("Sample Reg:", {
      id: regs[0].id,
      userId: regs[0].userId,
      eventId: regs[0].eventId,
      status: regs[0].registrationStatus,
      eventStart: regs[0].event.startTime,
      eventState: regs[0].event.state
    });
  }
}
run();
