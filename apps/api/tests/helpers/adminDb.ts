import { PrismaClient } from '@nst/database';

export const adminPrisma = new PrismaClient({
  datasources: {
    db: { url: "postgresql://postgres:postgres@localhost:5440/nst_events?schema=public" }
  }
});
