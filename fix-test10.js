const fs = require('fs');
const file = 'apps/api/tests/integration/phase26e-device-collision-race.test.ts';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  "user_id: student4, \n        session_id: sessionId,\n        scanned_token: generateCustomQrPayload(sessionId, 'SECRET', 0),",
  "user_id: student4, \n        session_id: sessionId,\n        scanned_token: generateCustomQrPayload(sessionId, 'SECRET', -3),"
);

fs.writeFileSync(file, code);
