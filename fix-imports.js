const fs = require('fs');
const file = 'apps/api/tests/integration/phase26g-gps-consistency.test.ts';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  "const app = createApp();\nimport { generateTotp } from '../../src/modules/attendance/totp.utils';",
  "const app = createApp();"
);

fs.writeFileSync(file, code);
