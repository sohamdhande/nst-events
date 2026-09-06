import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findFirst({
    where: { email: { contains: 'e25b070564' } }
  });

  if (!user) {
    console.log("User not found");
    process.exit(1);
  }

  const club = await prisma.club.findFirst();
  if (!club) {
    console.log("No club found");
    process.exit(1);
  }

  const now = new Date();
  const fiveHoursAgo = new Date(now.getTime() - 5 * 60 * 60 * 1000);
  const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000);

  const event = await prisma.event.create({
    data: {
      title: 'Past Event for Dispute Testing',
      description: 'An event that ended 5 hours ago.',
      startTime: sixHoursAgo,
      endTime: fiveHoursAgo,
      registrationType: 'INDIVIDUAL',
      lockState: 'UNLOCKED',
      creatorId: user.id,
      eventClubs: {
        create: {
          clubId: club.id,
          isPrimary: true
        }
      },
      attendanceSessions: {
        create: {
          title: 'Main Session',
          startTime: sixHoursAgo,
          endTime: fiveHoursAgo,
          openAt: sixHoursAgo,
          closeAt: fiveHoursAgo,
          qrSecret: 'secret_123',
          geofenceRadius: 50,
          pointsAwarded: 10
        }
      }
    }
  });

  await prisma.eventRegistration.create({
    data: {
      eventId: event.id,
      userId: user.id,
      status: 'REGISTERED'
    }
  });

  console.log(`Successfully created event ${event.id} and registered ${user.email}`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
