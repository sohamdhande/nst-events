import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const user = await prisma.user.findUnique({ where: { email: 'e25b070564@adypu.edu.in' } });
  if (!user) {
    console.log("User not found");
    return;
  }
  const clubs = await prisma.club.findMany();
  console.log("Clubs:", clubs.map(c => ({ id: c.id, name: c.name })));
}
main().catch(console.error).finally(() => prisma.$disconnect());
