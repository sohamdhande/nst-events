import { PrismaClient } from '@nst/database';
import { parseAdypuEmail } from '../src/modules/auth/academic-parser';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting backfill for academic profiles...');

  // Get all users who do NOT have an academic profile
  const usersWithoutProfile = await prisma.user.findMany({
    where: {
      academicProfile: null,
      deletedAt: null,
    },
    select: {
      id: true,
      email: true,
    },
  });

  console.log(`Found ${usersWithoutProfile.length} users without an academic profile.`);

  let successCount = 0;
  let skippedCount = 0;
  let ambiguousCount = 0;
  let unparseableCount = 0;

  for (const user of usersWithoutProfile) {
    const inference = parseAdypuEmail(user.email);
    
    if (!inference) {
      unparseableCount++;
      console.log(`[UNPARSEABLE] ${user.email} does not match the valid institutional format.`);
      continue;
    }

    const candidateBatches = await prisma.academicBatch.findMany({
      where: {
        admissionYear: inference.admissionYear,
        program: {
          code: inference.prefix,
        },
      },
    });

    if (candidateBatches.length === 1) {
      const resolvedBatch = candidateBatches[0];
      try {
        await prisma.userAcademicProfile.create({
          data: {
            userId: user.id,
            batchId: resolvedBatch.id,
            assignmentSource: 'EMAIL_INFERENCE',
          },
        });
        successCount++;
      } catch (err: any) {
        // Handle race conditions where they might have logged in and created one
        if (err.code === 'P2002') {
          skippedCount++;
        } else {
          console.error(`Error assigning ${user.email}:`, err);
        }
      }
    } else if (candidateBatches.length === 0) {
      unparseableCount++;
      console.log(`[NO_BATCH] ${user.email} matched prefix '${inference.prefix}' and year '${inference.admissionYear}', but no batch found.`);
    } else {
      ambiguousCount++;
      console.log(`[AMBIGUOUS] ${user.email} matched ${candidateBatches.length} possible batches. Auto-assignment skipped.`);
    }
  }

  console.log('\n--- BACKFILL COMPLETE ---');
  console.log(`Successfully assigned: ${successCount}`);
  console.log(`Skipped (concurrent creation): ${skippedCount}`);
  console.log(`Ambiguous (multiple batches): ${ambiguousCount}`);
  console.log(`Unparseable / No matching batch: ${unparseableCount}`);
}

main()
  .catch((e) => {
    console.error('Backfill script failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
