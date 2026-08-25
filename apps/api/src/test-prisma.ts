import { prisma } from './lib/prisma';
async function main() {
  const users = await prisma.user.findMany({ take: 2 });
  console.log("Users:", users.length);
}
main().catch(console.error).finally(() => prisma.$disconnect());
