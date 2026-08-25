import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { Client } from 'pg';

import { prisma } from './src/lib/prisma';
import { getEventRegistrations } from './src/modules/registrations/registrations.service';
import { attendanceService } from './src/modules/attendance/attendance.service';
import { withUserContext } from '@nst/database';
import { randomUUID } from 'crypto';

describe('Phase 15C', () => {
  const pgClient = new Client({ connectionString: "postgresql://postgres:postgres@localhost:5440/nst_events?schema=public" });
  before(async () => {
    const [role] = await prisma.$queryRawUnsafe<{ current_user: string, session_user: string }[]>('SELECT current_user, session_user;');
    console.log(role);
  });
  it('dummy', () => {});
  after(async () => {
    await pgClient.end();
  });
});
