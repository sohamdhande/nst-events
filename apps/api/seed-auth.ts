import { prisma } from './src/lib/prisma';

async function main() {
  const email = 'e25b070564@adypu.edu.in'.toLowerCase();
  
  const existing = await prisma.authorizedStudent.findUnique({
    where: { normalizedEmail: email }
  });
  
  if (existing) {
    console.log('Already exists');
  } else {
    await prisma.authorizedStudent.create({
      data: { normalizedEmail: email }
    });
    console.log('Successfully inserted');
  }
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
