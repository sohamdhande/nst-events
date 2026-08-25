const fs = require('fs');
const file = 'apps/api/tests/integration/phase26e-device-collision-race.test.ts';
let code = fs.readFileSync(file, 'utf8');

// Add import
code = code.replace(
  "import crypto from 'node:crypto';",
  "import crypto from 'node:crypto';\nimport { generateQrPayload } from '../../src/modules/attendance/totp.utils';"
);

// Replace hardcoded tokens
code = code.replace(
  "scanned_token: 'offline_unique_tok1',",
  "scanned_token: generateQrPayload(sessionId, 'SECRET'),"
);
code = code.replace(
  "scanned_token: 'offline_unique_tok2',",
  "scanned_token: generateQrPayload(sessionId, 'SECRET'),"
);

fs.writeFileSync(file, code);
