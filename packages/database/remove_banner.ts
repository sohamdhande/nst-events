import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.club.update({
    where: { name: 'Dev Club' },
    data: { bannerUrl: null }
  });
  console.log('Banner removed.');
}

main().finally(() => prisma.$disconnect());
