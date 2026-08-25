import { describe, before, it, after } from 'node:test';
import { prisma } from './src/lib/prisma';
import { Client } from 'pg';
const pgClient = new Client({ connectionString: "postgresql://postgres:postgres@localhost:5440/nst_events?schema=public" });
describe('test', () => {
  before(async () => {
    console.log("running query in before...");
    const res = await prisma.$queryRawUnsafe('SELECT current_user, session_user;');
    console.log("res:", res);
  });
  it('passes', () => {});
  after(async () => await prisma.$disconnect());
});
