const prisma = require('./src/lib/prisma').default;

async function run() {
  const events = await prisma.event.findMany();
  console.log('Events via prisma:', events);
  process.exit(0);
}
run();
