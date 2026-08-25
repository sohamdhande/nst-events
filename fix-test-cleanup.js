const fs = require('fs');
const file = 'apps/api/tests/integration/phase26g-gps-consistency.test.ts';
let code = fs.readFileSync(file, 'utf8');

const cleanup = `
    await adminPrisma.$executeRawUnsafe(\`ALTER TABLE users DISABLE ROW LEVEL SECURITY\`);
    await adminPrisma.leaderboardScore.deleteMany({ where: { userId: { in: [admin, student] } } });
    await adminPrisma.attendanceRecord.deleteMany({ where: { sessionId } });
    await adminPrisma.consumedQrSignature.deleteMany({ where: { sessionId } });
    await adminPrisma.eventRegistration.deleteMany({ where: { eventId } });
    await adminPrisma.attendanceSession.deleteMany({ where: { eventId } });
    await adminPrisma.clubMembership.deleteMany({ where: { clubId } });
    await adminPrisma.event.deleteMany({ where: { id: eventId } });
    await adminPrisma.club.deleteMany({ where: { id: clubId } });
    await adminPrisma.user.deleteMany({ where: { id: { in: [admin, student] } } });
    await adminPrisma.$executeRawUnsafe(\`ALTER TABLE users ENABLE ROW LEVEL SECURITY\`);
`;

code = code.replace(
  "  before(async () => {",
  "  before(async () => {" + cleanup
);

fs.writeFileSync(file, code);
