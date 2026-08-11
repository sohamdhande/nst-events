import { adminPrisma } from './helpers/adminDb';

async function run() {
  await adminPrisma.notificationJob.deleteMany({});
  await adminPrisma.pushToken.deleteMany({});
  await adminPrisma.user.deleteMany({ where: { email: { startsWith: 'worker-test' } } });
  console.log('Cleaned up');
}
run().catch(console.error);
