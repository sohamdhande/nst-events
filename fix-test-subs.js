const fs = require('fs');
const file = 'apps/api/tests/integration/phase26g-gps-consistency.test.ts';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(/'ag'/g, "'ag99'");
code = code.replace(/'sg'/g, "'sg99'");

fs.writeFileSync(file, code);
