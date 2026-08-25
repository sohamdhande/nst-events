import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function run() {
  try {
    // We will just invoke the function with a dummy UUID
    await prisma.$queryRaw`SELECT id FROM lock_event('8e34fa2f-d9e8-4700-0000-000000000000'::uuid)`;
  } catch (e: any) {
    console.error("NAME:", e.name);
    console.error("MESSAGE:", e.message);
  }
}
run();
