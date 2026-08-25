const fs = require('fs');
const file = 'apps/api/tests/integration/phase26e-device-collision-race.test.ts';
let code = fs.readFileSync(file, 'utf8');
code = code.replace("  let adminToken: string;", "  let adminToken: string;\n  let sandbox: any;");
code = code.replace("  before(async () => {", "  before(async () => {\n    sandbox = require('sinon').createSandbox();\n    const prisma = require('../../src/lib/prisma').default;\n    sandbox.stub(prisma.attendanceSession, 'findMany').resolves([{ id: sessionId, qrSecret: 'SECRET' }]);");
fs.writeFileSync(file, code);
