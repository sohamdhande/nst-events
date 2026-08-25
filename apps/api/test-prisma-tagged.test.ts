import { describe, before, it, after } from 'node:test';
import { prisma } from './src/lib/prisma';
describe('test', () => {
  before(async () => {
    console.log("running query...");
    const res = await prisma.$queryRaw\`SELECT current_user, session_user;\`;
    console.log("res:", res);
  });
  it('passes', () => {});
  after(async () => await prisma.$disconnect());
});
