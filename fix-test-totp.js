const fs = require('fs');
const file = 'apps/api/tests/integration/phase26g-gps-consistency.test.ts';
let code = fs.readFileSync(file, 'utf8');

code = code.replace("import { generateTotp } from '../../src/modules/attendance/totp.utils';", "import { generateCustomQrPayload } from '../helpers/qr';");
code = code.replace(/generateTotp\('SECRET'\)/g, "generateCustomQrPayload(sessionId, 'SECRET', 0)");
code = code.replace(/generateTotp\('SECRET', -100\)/g, "generateCustomQrPayload(sessionId, 'SECRET', -100)");
code = code.replace(/generateTotp\('SECRET', -200\)/g, "generateCustomQrPayload(sessionId, 'SECRET', -200)");
code = code.replace(/generateTotp\('SECRET', -300\)/g, "generateCustomQrPayload(sessionId, 'SECRET', -300)");

fs.writeFileSync(file, code);
