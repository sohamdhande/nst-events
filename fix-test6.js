const fs = require('fs');
const file = 'apps/api/tests/integration/phase26e-device-collision-race.test.ts';
let code = fs.readFileSync(file, 'utf8');
code = code.replace(/generateQrPayload\(sessionId, 'SECRET'\)/g, "generateCustomQrPayload(sessionId, 'SECRET', 0)");
fs.writeFileSync(file, code);
