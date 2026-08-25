const fs = require('fs');
const file = 'apps/api/tests/integration/phase26g-gps-consistency.test.ts';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(/generateCustomQrPayload\(sessionId, 'SECRET', -100\)/g, "generateCustomQrPayload(sessionId, 'SECRET', 0)");
code = code.replace(/generateCustomQrPayload\(sessionId, 'SECRET', -200\)/g, "generateCustomQrPayload(sessionId, 'SECRET', 0)");
code = code.replace(/generateCustomQrPayload\(sessionId, 'SECRET', -300\)/g, "generateCustomQrPayload(sessionId, 'SECRET', 0)");

fs.writeFileSync(file, code);
