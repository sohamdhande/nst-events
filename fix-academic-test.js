const fs = require('fs');
const path = 'apps/api/tests/integration/academic-identity.test.ts';
let code = fs.readFileSync(path, 'utf8');
code = code.replace(/'ADMIN'/g, "'ADMIN_OVERRIDE'");
code = code.replace(/'EMAIL_INFERENCE'/g, "'INSTITUTIONAL_EMAIL_INFERENCE'");
fs.writeFileSync(path, code);
