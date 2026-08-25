import { prisma } from './apps/api/src/lib/prisma';
import { adminPrisma } from './apps/api/tests/helpers/adminDb';

async function main() {
  const job = await adminPrisma.notificationJob.create({
    data: {
      status: 'FAILED',
      payload: { job_type: 'SYSTEM' },
      idempotencyKey: 'test-script-3'
    }
  });

  const jobId = job.id;
  console.log('Created job:', jobId);

  await prisma.$transaction(async (tx) => {
    const found = await tx.notificationJob.findUnique({ where: { id: jobId } });
    console.log('Found via regular prisma:', found?.status);

    const { count } = await tx.notificationJob.updateMany({
      where: { id: jobId, status: 'FAILED' },
      data: { status: 'PENDING' }
    });
    console.log('Updated count:', count);
  });

  await adminPrisma.notificationJob.delete({ where: { id: jobId } });
}

main().catch(console.error);
