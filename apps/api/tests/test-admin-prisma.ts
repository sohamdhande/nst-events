import { adminPrisma } from './helpers/adminDb';

async function run() {
  const event = await adminPrisma.event.create({
    data: {
      title: 'Admin Test Event',
      startTime: new Date(),
      endTime: new Date(),
      eventType: 'OTHER',
      visibility: 'PUBLIC',
      createdBy: '3b831aa7-665e-4de5-8ac6-af968ff691a7' // Just some UUID
    }
  });
  console.log('Created event', event.id);

  // Try to update it
  await adminPrisma.event.update({
    where: { id: event.id },
    data: { state: 'DRAFT' }
  });
  console.log('Updated event');
}
run().catch(console.error);
