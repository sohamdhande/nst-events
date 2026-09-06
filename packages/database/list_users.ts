import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({ select: { id: true, email: true, globalRole: true } });
  console.log("Users in DB:", users);
  
  const clubs = await prisma.club.findMany({ select: { id: true, name: true } });
  console.log("Clubs in DB:", clubs);
}

main().finally(() => prisma.$disconnect());
