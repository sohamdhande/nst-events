const fs = require('fs');
const file = 'apps/api/tests/integration/phase26g-gps-consistency.test.ts';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(/'CG'/g, "'CG99'");
code = code.replace(/'EG'/g, "'EG99'");

fs.writeFileSync(file, code);
