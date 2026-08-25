const fs = require('fs');
const file = 'apps/api/tests/integration/phase26e-device-collision-race.test.ts';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  "await adminPrisma.leaderboardScore.deleteMany({ where: { userId: student4 } });",
  "await adminPrisma.attendanceRecord.deleteMany({ where: { userId: student4 } });\n    await adminPrisma.leaderboardScore.deleteMany({ where: { userId: student4 } });"
);

fs.writeFileSync(file, code);
