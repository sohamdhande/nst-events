import { prisma } from './src/lib/prisma';
async function run() {
  console.log("running query...");
  const res = await prisma.$queryRawUnsafe('SELECT current_user, session_user;');
  console.log("res:", res);
  await prisma.$disconnect();
}
run();
