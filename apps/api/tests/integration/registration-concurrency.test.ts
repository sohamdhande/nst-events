import test from 'node:test';
import assert from 'node:assert';
import { prisma } from '../../src/lib/prisma';
import { adminPrisma } from '../helpers/adminDb';
import { registerEvent } from '../../src/modules/registrations/registrations.service';

test('Registration Concurrency Race', async (t) => {
  // 1. Setup mock event with capacity 3
  const organizer = await adminPrisma.user.create({
    data: {
      email: `org-${Date.now()}@test.com`,
      googleSub: `sub-org-${Date.now()}`,
      fullName: 'Organizer User',
    }
  });

  const testEvent = await adminPrisma.event.create({
    data: {
      title: 'Concurrency Test Event',
      description: 'Capacity 3',
      locationName: 'Test',
      state: 'PUBLISHED',
      registrationType: 'INDIVIDUAL',
      maxCapacity: 3,
      registrationCount: 0,
      createdBy: organizer.id,
      eventType: 'WORKSHOP',
      startTime: new Date(),
      endTime: new Date(Date.now() + 100000),
    }
  });

  // 2. Setup 10 distinct mock users
  const userIds: string[] = [];
  for (let i = 0; i < 10; i++) {
    const u = await adminPrisma.user.create({
      data: {
        email: `reg-${i}-${Date.now()}@test.com`,
        googleSub: `sub-reg-${i}-${Date.now()}`,
        fullName: `Reg User ${i}`,
      }
    });
    userIds.push(u.id);
  }

  // 3. Fire 10 simultaneous registration requests
  const results = await Promise.allSettled(
    userIds.map(uid => registerEvent(uid, testEvent.id))
  );

  // 4. Verify Database Invariants
  const dbEvent = await adminPrisma.event.findUnique({ where: { id: testEvent.id } });
  assert.strictEqual(dbEvent?.registrationCount, 3, 'registration_count should not exceed 3');

  const registrations = await adminPrisma.eventRegistration.findMany({
    where: { eventId: testEvent.id }
  });

  const registered = registrations.filter(r => r.registrationStatus === 'REGISTERED');
  const waitlisted = registrations.filter(r => r.registrationStatus === 'WAITLISTED');

  assert.strictEqual(registered.length, 3, 'Exactly 3 users should be REGISTERED');
  assert.strictEqual(waitlisted.length, 7, 'Exactly 7 users should be WAITLISTED');

  // Verify no duplicates
  const distinctUsers = new Set(registrations.map(r => r.userId));
  assert.strictEqual(distinctUsers.size, 10, 'Each user should only have 1 registration record');

  // Cleanup
  await adminPrisma.eventRegistration.deleteMany({ where: { eventId: testEvent.id } });
  await adminPrisma.event.delete({ where: { id: testEvent.id } });
  await adminPrisma.user.deleteMany({ where: { id: { in: [...userIds, organizer.id] } } });
});
