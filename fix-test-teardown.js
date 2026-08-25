const fs = require('fs');
const file = 'apps/api/tests/integration/phase26g-gps-consistency.test.ts';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  "await adminPrisma.clubMembership.deleteMany({ where: { clubId } });\n    await adminPrisma.event.deleteMany({ where: { id: eventId } });",
  "await adminPrisma.clubMembership.deleteMany({ where: { clubId } });\n    await adminPrisma.eventClub.deleteMany({ where: { eventId } });\n    await adminPrisma.event.deleteMany({ where: { id: eventId } });"
);

fs.writeFileSync(file, code);
