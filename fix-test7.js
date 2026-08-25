const fs = require('fs');
const file = 'apps/api/tests/integration/phase26e-device-collision-race.test.ts';
let code = fs.readFileSync(file, 'utf8');

// The file has two occurrences. The first one is for student3, second is for student4.
// We'll replace the second one with offset 1.
let parts = code.split("generateCustomQrPayload(sessionId, 'SECRET', 0)");
if (parts.length === 3) {
  code = parts[0] + "generateCustomQrPayload(sessionId, 'SECRET', 0)" + parts[1] + "generateCustomQrPayload(sessionId, 'SECRET', 1)" + parts[2];
  fs.writeFileSync(file, code);
}
