import { PrismaClient, GlobalRole, RegistrationStatus, ParticipationRole } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const email = 'teamlearnnest@gmail.com';
  
  console.log(`Setting up test user: ${email}`);

  // 1. Add to authorized_students (to ensure full bypass/recognition)
  await prisma.authorizedStudent.upsert({
    where: { normalizedEmail: email },
    update: { status: 'ACTIVE' },
    create: { normalizedEmail: email, status: 'ACTIVE' }
  });
  console.log('✅ Added to authorized_students');

  // 2. Ensure User exists
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email,
        fullName: 'Test Student (Learn Nest)',
        googleSub: 'manual-setup-' + Date.now(),
        globalRole: GlobalRole.STUDENT,
      }
    });
    console.log('✅ Created user record');
  } else {
    user = await prisma.user.update({
      where: { id: user.id },
      data: { globalRole: GlobalRole.STUDENT }
    });
    console.log('✅ Updated existing user to STUDENT');
  }

  // 3. Find or create an active event
  let event = await prisma.event.findFirst({
    where: { state: 'PUBLISHED', isLocked: false }
  });

  if (!event) {
    const admin = await prisma.user.findFirst({ where: { globalRole: 'PLATFORM_ADMIN' }});
    if (!admin) throw new Error('No admin found to create event');
    
    event = await prisma.event.create({
      data: {
        title: 'Active Test Event',
        description: 'Created for testing registration.',
        startTime: new Date(Date.now() - 3600000), // Started 1 hour ago
        endTime: new Date(Date.now() + 86400000),  // Ends tomorrow
        locationName: 'Test Lab',
        eventType: 'SEMINAR',
        state: 'PUBLISHED',
        visibility: 'PUBLIC',
        registrationType: 'INDIVIDUAL',
        attendanceType: 'SINGLE',
        isLocked: false,
        createdBy: admin.id,
      }
    });
    console.log('✅ Created new active event:', event.title);
  } else {
    console.log('✅ Found active event:', event.title);
  }

  // 4. Register the user for the event
  const existingReg = await prisma.eventRegistration.findFirst({
    where: { eventId: event.id, userId: user.id }
  });

  if (!existingReg) {
    await prisma.eventRegistration.create({
      data: {
        eventId: event.id,
        userId: user.id,
        registrationStatus: RegistrationStatus.REGISTERED,
        participationRole: ParticipationRole.ATTENDEE
      }
    });
    console.log('✅ Registered user for the event');
  } else {
    await prisma.eventRegistration.update({
      where: { id: existingReg.id },
      data: { registrationStatus: RegistrationStatus.REGISTERED }
    });
    console.log('✅ User already registered, ensured status is REGISTERED');
  }

  console.log('Done!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
