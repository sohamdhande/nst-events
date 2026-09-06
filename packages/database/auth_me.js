const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  try {
    await p.authorizedStudent.upsert({
      where: { normalizedEmail: 'e25b070564@adypu.edu.in' },
      update: { status: 'ACTIVE' },
      create: { normalizedEmail: 'e25b070564@adypu.edu.in', status: 'ACTIVE' },
    });
    console.log('Authorized e25b070564@adypu.edu.in successfully!');
  } catch (err) {
    console.error(err);
  } finally {
    await p.$disconnect();
  }
}

main();
