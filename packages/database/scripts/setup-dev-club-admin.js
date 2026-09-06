const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const email = 'e25b070564@adypu.edu.in';
  const user = await prisma.user.findUnique({ where: { email } });
  let club = await prisma.club.findFirst({ where: { name: { contains: 'Dev', mode: 'insensitive' } } });

  let membership = await prisma.clubMembership.findFirst({ where: { userId: user.id, clubId: club.id } });
  if (membership) {
    await prisma.clubMembership.update({ where: { id: membership.id }, data: { role: 'CLUB_ADMIN' } });
  } else {
    await prisma.clubMembership.create({ data: { userId: user.id, clubId: club.id, role: 'CLUB_ADMIN' } });
  }
  console.log("User made CLUB_ADMIN of", club.name);

  const event = await prisma.event.create({
    data: {
      title: 'Dev Club Active Event 3',
      description: 'Active event for testing',
      eventType: 'WORKSHOP',
      state: 'PUBLISHED',
      visibility: 'PUBLIC',
      registrationType: 'INDIVIDUAL',
      attendanceType: 'SINGLE',
      startTime: new Date(Date.now() - 3600000), // started 1 hr ago
      endTime: new Date(Date.now() + 3600000), // ends in 1 hr
      createdBy: user.id,
      eventClubs: {
        create: {
          clubId: club.id,
          isPrimary: true
        }
      },
      attendanceSessions: {
        create: {
          title: 'Main Session',
          startTime: new Date(Date.now() - 3600000),
          endTime: new Date(Date.now() + 3600000),
          openAt: new Date(Date.now() - 3600000),
          closeAt: new Date(Date.now() + 3600000),
          qrSecret: 'qr-secret-12345',
          createdBy: user.id
        }
      }
    }
  });
  console.log("Event created:", event.id, event.title);
}
main().catch(console.error).finally(() => prisma.$disconnect());
