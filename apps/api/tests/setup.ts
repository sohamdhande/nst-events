process.env.DATABASE_URL = "postgresql://nst_app:nst_app_password@127.0.0.1:5440/nst_events?schema=public";
process.env.WORKER_DATABASE_URL = "postgresql://nst_worker:worker_password@127.0.0.1:5440/nst_events?schema=public";
process.env.ADMIN_DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:5440/nst_events?schema=public";

import { prisma } from '../src/lib/prisma';
import { adminPrisma } from './helpers/adminDb';
import { pgListener } from '../src/modules/sse/pg-listener';

import { after } from 'node:test';

after(async () => {
  await prisma.$disconnect();
  await adminPrisma.$disconnect();
  await pgListener.disconnect();
});
