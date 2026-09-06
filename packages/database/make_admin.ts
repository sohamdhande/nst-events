import { PrismaClient, GlobalRole, ClubRole } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const email = 'e25b070564@adypu.edu.in';
  
  // Find user
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`User ${email} not found`);
    return;
  }
  
  // Find club
  const club = await prisma.club.findFirst({
    where: { name: { contains: 'Dev', mode: 'insensitive' } }
  });
  if (!club) {
    console.error(`NST Developers Club not found`);
    return;
  }

  // Ensure global role is STUDENT so user retains student access
  if (user.globalRole !== GlobalRole.STUDENT) {
    await prisma.user.update({
      where: { id: user.id },
      data: { globalRole: GlobalRole.STUDENT }
    });
    console.log(`Ensure global role for ${email} is STUDENT`);
  }
  
  // Upsert club membership
  await prisma.clubMember.upsert({
    where: {
      clubId_userId: {
        clubId: club.id,
        userId: user.id
      }
    },
    update: {
      role: ClubRole.CLUB_ADMIN
    },
    create: {
      clubId: club.id,
      userId: user.id,
      role: ClubRole.CLUB_ADMIN
    }
  });
  console.log(`Added ${email} as CLUB_ADMIN to ${club.name}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
