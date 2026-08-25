const fs = require('fs');
const file = 'apps/api/tests/integration/phase26e-device-collision-race.test.ts';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  "scanned_token: generateCustomQrPayload(sessionId, 'SECRET', 0),",
  "scanned_token: generateCustomQrPayload(sessionId, 'SECRET', -2),"
);
code = code.replace(
  "scanned_token: generateCustomQrPayload(sessionId, 'SECRET', 1),",
  "scanned_token: generateCustomQrPayload(sessionId, 'SECRET', -3),"
);

fs.writeFileSync(file, code);
