const fs = require('fs');
const file = 'apps/api/tests/integration/phase26g-gps-consistency.test.ts';
let code = fs.readFileSync(file, 'utf8');

const qrPayloadImpl = `
import crypto from 'crypto';

function generateCustomQrPayload(sessionId: string, qrSecret: string, offsetWindows: number): string {
  const windowEpoch = Math.floor(Date.now() / 15000) + offsetWindows;
  const hmacInput = \`v1:\${sessionId}:\${windowEpoch}\`;
  const hmac = crypto.createHmac('sha256', qrSecret);
  hmac.update(hmacInput);
  const base64Url = hmac.digest('base64').replace(/\\+/g, '-').replace(/\\//g, '_').replace(/=+$/, '');
  const signature = base64Url.substring(0, 16);
  return \`v1:\${sessionId}:\${signature}\`;
}
`;

code = code.replace(/import crypto from 'crypto';[\s\S]*?\}\n/, qrPayloadImpl);

fs.writeFileSync(file, code);
