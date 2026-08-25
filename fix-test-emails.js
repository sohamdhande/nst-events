const fs = require('fs');
const file = 'apps/api/tests/integration/phase26g-gps-consistency.test.ts';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(/'admin_g@adypu.edu.in'/g, "'admin_g99@adypu.edu.in'");
code = code.replace(/'student_g@adypu.edu.in'/g, "'student_g99@adypu.edu.in'");

fs.writeFileSync(file, code);
