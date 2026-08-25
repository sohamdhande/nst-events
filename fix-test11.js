const fs = require('fs');
const file = 'apps/api/tests/integration/phase26e-device-collision-race.test.ts';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  "await adminPrisma.user.deleteMany({ where: { email: { in: ['s4@adypu.edu.in', 's5@adypu.edu.in'] } } });",
  "await adminPrisma.leaderboardScore.deleteMany({ where: { user: { email: { in: ['s4@adypu.edu.in', 's5@adypu.edu.in'] } } } });\n    await adminPrisma.user.deleteMany({ where: { email: { in: ['s4@adypu.edu.in', 's5@adypu.edu.in'] } } });"
);

fs.writeFileSync(file, code);
