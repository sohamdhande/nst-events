const fs = require('fs');
const file = 'apps/api/tests/integration/phase26e-device-collision-race.test.ts';
let code = fs.readFileSync(file, 'utf8');
code = code.replace(
  "    sandbox.stub(prisma.attendanceSession, 'findMany').resolves([{ id: sessionId, qrSecret: 'SECRET' }]);",
  "    const dbSess = await adminPrisma.attendanceSession.findMany({ where: { id: sessionId } }); console.log('DEBUG:', dbSess);"
);
fs.writeFileSync(file, code);
