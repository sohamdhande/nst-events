import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient({
  datasources: { db: { url: "postgresql://nst_app:nst_app_password@127.0.0.1:5440/nst_events?schema=public" } }
});
async function main() {
  const users = await prisma.user.findMany({ take: 2 });
  console.log("Users:", users.length);
}
main().catch(console.error).finally(() => prisma.$disconnect());
