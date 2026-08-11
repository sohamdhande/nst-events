import { PrismaClient } from '@prisma/client';
import { adminPrisma } from './helpers/adminDb';

async function run() {
  const workerPrisma = new PrismaClient({
    datasourceUrl: 'postgresql://nst_worker:worker_password@localhost:5440/nst_events?schema=public'
  });

  const testUser = await adminPrisma.user.create({
    data: {
      email: `worker-test-${Date.now()}@test.com`,
      googleSub: `sub-worker-${Date.now()}`,
      fullName: 'Worker User',
    }
  });
  console.log('Created user', testUser.id);

  const user = await workerPrisma.user.findUnique({ where: { id: testUser.id } });
  console.log('Worker found user:', !!user);
  
  if (user) {
    console.log('deleted_at:', user.deletedAt);
  } else {
    console.log('User not found by workerPrisma!');
  }
}
run().catch(console.error);
