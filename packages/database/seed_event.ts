import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  let club = await prisma.club.findFirst({
    where: { name: { contains: 'NST Developers', mode: 'insensitive' } }
  });

  if (!club) {
    console.log('Creating NST Developers Club...');
    club = await prisma.club.create({
      data: {
        name: 'NST Developers Club',
        description: 'The official developers club.',
      }
    });
  }

  // Find a Global Admin or Platform Admin to act as creator
  let admin = await prisma.user.findFirst({
    where: { globalRole: 'PLATFORM_ADMIN' }
  });

  if (!admin) {
    console.log('No platform admin found. Creating one...');
    admin = await prisma.user.create({
      data: {
        email: 'admin@nst.edu',
        globalRole: 'PLATFORM_ADMIN'
      }
    });
  }

  const now = new Date();
  
  // LIVE EVENT: Starts 1 hour ago, ends in 2 days
  const startTime = new Date(now.getTime() - 1 * 60 * 60 * 1000); 
  const endTime = new Date(now.getTime() + 48 * 60 * 60 * 1000); 

  const event = await prisma.event.create({
    data: {
      title: 'NST Hackathon 2026 (LIVE)',
      description: 'An ongoing, live hackathon for building the future of web and AI applications.',
      startTime,
      endTime,
      locationName: 'Innovation Hub',
      state: 'PUBLISHED', // Direct to published
      eventType: 'HACKATHON',
      isLocked: false,
      registrationType: 'INDIVIDUAL',
      registrationCount: 0,
      maxCapacity: 500,
      metadata: {},
      creator: {
        connect: {
          id: admin.id
        }
      },
      eventClubs: {
        create: {
          clubId: club.id,
          isPrimary: true
        }
      },
      attendanceSessions: {
        create: [
          {
            title: 'Opening Ceremony & Hacking Phase 1',
            startTime: startTime,
            endTime: new Date(startTime.getTime() + 12 * 60 * 60 * 1000), // 12 hours long
            // Session is currently OPEN
            openAt: new Date(now.getTime() - 30 * 60 * 1000), // Opened 30 mins ago
            closeAt: new Date(now.getTime() + 4 * 60 * 60 * 1000), // Closes in 4 hours
            venueLatitude: 40.7128,
            venueLongitude: -74.0060,
            geofenceRadius: 200,
            qrSecret: 'hackathon_phase1_live',
            createdBy: admin.id
          },
          {
            title: 'Hacking Phase 2 & Check-in',
            startTime: new Date(now.getTime() + 12 * 60 * 60 * 1000),
            endTime: new Date(now.getTime() + 24 * 60 * 60 * 1000),
            openAt: new Date(now.getTime() + 12 * 60 * 60 * 1000),
            closeAt: new Date(now.getTime() + 14 * 60 * 60 * 1000),
            venueLatitude: 40.7128,
            venueLongitude: -74.0060,
            geofenceRadius: 200,
            qrSecret: 'hackathon_phase2',
            createdBy: admin.id
          }
        ]
      }
    },
    include: {
      eventClubs: true,
      attendanceSessions: true
    }
  });

  console.log('Successfully created LIVE event:');
  console.log('ID:', event.id);
  console.log('Title:', event.title);
  console.log('Sessions Created:', event.attendanceSessions.length);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
