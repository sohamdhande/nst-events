const fs = require('fs');
const file = 'apps/api/tests/integration/phase26e-device-collision-race.test.ts';
let code = fs.readFileSync(file, 'utf8');
code = code.replace("const prisma = require('../../src/lib/prisma').default;", "const { prisma } = require('@nst/database');");
fs.writeFileSync(file, code);
