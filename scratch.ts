import { PrismaClient } from '@nst/database';
const prisma = new PrismaClient();
async function run() {
  const users = await prisma.user.findMany({ select: { id: true, email: true, googleSub: true, deletedAt: true } });
  console.log("USERS:", users);
  await prisma.$disconnect();
}
run();
