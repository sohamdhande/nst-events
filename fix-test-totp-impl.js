const fs = require('fs');
const file = 'apps/api/tests/integration/phase26g-gps-consistency.test.ts';
let code = fs.readFileSync(file, 'utf8');

code = code.replace("import { generateCustomQrPayload } from '../helpers/qr';", `
import crypto from 'crypto';

function generateCustomQrPayload(sessionId: string, qrSecret: string, offsetWindows: number): string {
  const windowSize = 15;
  const currentWindow = Math.floor(Date.now() / 1000 / windowSize) + offsetWindows;
  const data = \`\${sessionId}:\${currentWindow}\`;
  const signature = crypto.createHmac('sha256', qrSecret).update(data).digest('hex');
  return Buffer.from(JSON.stringify({
    sessionId,
    signature,
    timestamp: new Date().toISOString()
  })).toString('base64');
}
`);

fs.writeFileSync(file, code);
