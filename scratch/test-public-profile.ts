import { withUserContext } from '@nst/database';
import { prisma } from '../apps/api/src/lib/prisma';
async function main() {
  await withUserContext('00000000-0000-0000-0000-000000000011', async (tx) => {
    const profiles = await tx.publicProfile.findMany({ take: 2 });
    console.log("Profiles:", profiles.length);
  });
}
main().catch(console.error).finally(() => prisma.$disconnect());
