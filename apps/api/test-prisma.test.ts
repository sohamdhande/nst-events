import { test } from 'node:test';
import { prisma } from './src/lib/prisma';
test('prisma', async () => {
  console.log("running query...");
  const res = await prisma.$queryRawUnsafe('SELECT current_user, session_user;');
  console.log("res:", res);
  await prisma.$disconnect();
});
