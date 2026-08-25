const fs = require('fs');
const file = 'apps/api/tests/integration/phase26e-device-collision-race.test.ts';
let code = fs.readFileSync(file, 'utf8');
code = code.replace(
  "    const dbSess = await adminPrisma.attendanceSession.findMany({ where: { id: sessionId } }); console.log('DEBUG:', dbSess);",
  "    const rawSess = await adminPrisma.$queryRawUnsafe(`SELECT * FROM attendance_sessions WHERE id = '${sessionId}'`); console.log('RAW DEBUG:', rawSess);"
);
fs.writeFileSync(file, code);
