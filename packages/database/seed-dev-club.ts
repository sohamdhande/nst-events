import { PrismaClient, Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

async function main() {
  const clubName = 'Dev Club';
  
  let devClub = await prisma.club.findFirst({
    where: { name: clubName }
  });

  if (!devClub) {
    devClub = await prisma.club.findFirst({
      where: { name: { contains: 'Dev' } }
    });
  }

  if (!devClub) {
    console.error('Could not find Dev Club');
    return;
  }

  console.log(`Found Club: ${devClub.name} (${devClub.id})`);

  console.log('Starting Event generation...');

  // Generate Events
  const adminUser = await prisma.user.findFirst({ where: { globalRole: 'PLATFORM_ADMIN' } });
  if (!adminUser) {
    console.error('No PLATFORM_ADMIN found to create events.');
    return;
  }

  const now = new Date();
  
  // Create 5 past events
  for (let i = 1; i <= 5; i++) {
    const pastStart = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000); // i weeks ago
    const pastEnd = new Date(pastStart.getTime() + 2 * 60 * 60 * 1000); // 2 hours long

    const event = await prisma.event.create({
      data: {
        title: `Past Dev Club Meetup ${i}`,
        description: 'A great past event.',
        startTime: pastStart,
        endTime: pastEnd,
        eventType: 'MEETUP',
        state: 'PUBLISHED',
        createdBy: adminUser.id,
      }
    });

    await prisma.eventClub.create({
      data: {
        eventId: event.id,
        clubId: devClub.id,
        isPrimary: true,
      }
    });

    console.log(`Created past event: ${event.title}`);
  }

  // Create 5 future events
  for (let i = 1; i <= 5; i++) {
    const futureStart = new Date(now.getTime() + i * 7 * 24 * 60 * 60 * 1000); // i weeks from now
    const futureEnd = new Date(futureStart.getTime() + 2 * 60 * 60 * 1000);

    const event = await prisma.event.create({
      data: {
        title: `Future Dev Club Hackathon ${i}`,
        description: 'An upcoming hackathon.',
        startTime: futureStart,
        endTime: futureEnd,
        eventType: 'HACKATHON',
        state: 'PUBLISHED',
        createdBy: adminUser.id,
      }
    });

    await prisma.eventClub.create({
      data: {
        eventId: event.id,
        clubId: devClub.id,
        isPrimary: true,
      }
    });

    console.log(`Created future event: ${event.title}`);
  }

  console.log('Event seeding complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
