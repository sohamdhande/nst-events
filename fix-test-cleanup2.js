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
    await adminPrisma.eventClub.deleteMany({ where: { eventId } });
    await adminPrisma.event.deleteMany({ where: { id: eventId } });
    await adminPrisma.club.deleteMany({ where: { id: clubId } });
    await adminPrisma.user.deleteMany({ where: { id: { in: [admin, student] } } });
    await adminPrisma.$executeRawUnsafe(\`ALTER TABLE users ENABLE ROW LEVEL SECURITY\`);
`;

code = code.replace(
  "    await adminPrisma.$executeRawUnsafe(`ALTER TABLE users DISABLE ROW LEVEL SECURITY`);\n    await adminPrisma.leaderboardScore.deleteMany({ where: { userId: { in: [admin, student] } } });\n    await adminPrisma.attendanceRecord.deleteMany({ where: { sessionId } });\n    await adminPrisma.consumedQrSignature.deleteMany({ where: { sessionId } });\n    await adminPrisma.eventRegistration.deleteMany({ where: { eventId } });\n    await adminPrisma.attendanceSession.deleteMany({ where: { eventId } });\n    await adminPrisma.clubMembership.deleteMany({ where: { clubId } });\n    await adminPrisma.event.deleteMany({ where: { id: eventId } });\n    await adminPrisma.club.deleteMany({ where: { id: clubId } });\n    await adminPrisma.user.deleteMany({ where: { id: { in: [admin, student] } } });\n    await adminPrisma.$executeRawUnsafe(`ALTER TABLE users ENABLE ROW LEVEL SECURITY`);",
  cleanup
);

fs.writeFileSync(file, code);
