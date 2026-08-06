import { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from './client';

export async function withUserContext<T>(
  userId: string | undefined | null,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
  db: PrismaClient = prisma
): Promise<T> {
  return db.$transaction(async (tx) => {
    const value = userId || '';
    await tx.$executeRaw`SELECT set_config('app.user_id', ${value}, true)`;
    return fn(tx);
  });
}
