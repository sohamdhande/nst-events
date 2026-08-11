import { adminPrisma } from './helpers/adminDb';

async function run() {
  const jobs = await adminPrisma.notificationJob.findMany();
  for (const job of jobs) {
    console.log(`Job: ${job.id}, Status: ${job.status}, User: ${(job.payload as any).user_id}`);
  }
}
run().catch(console.error);
