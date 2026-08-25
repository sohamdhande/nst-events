const fs = require('fs');
const file = 'apps/api/tests/integration/phase26g-gps-consistency.test.ts';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(/'f74c7c5b-7b00-4b6c-8c01-8b01c0c0c0c0'/g, "'f74c7c5b-7b00-4b6c-8c01-8b01c0c0c990'");
code = code.replace(/'f74c7c5b-7b00-4b6c-8c01-8b01c0c0c0c1'/g, "'f74c7c5b-7b00-4b6c-8c01-8b01c0c0c991'");
code = code.replace(/'f74c7c5b-7b00-4b6c-8c01-8b01c0c0c0c2'/g, "'f74c7c5b-7b00-4b6c-8c01-8b01c0c0c992'");
code = code.replace(/'f74c7c5b-7b00-4b6c-8c01-8b01c0c0c0d1'/g, "'f74c7c5b-7b00-4b6c-8c01-8b01c0c0c993'");
code = code.replace(/'f74c7c5b-7b00-4b6c-8c01-8b01c0c0c0d2'/g, "'f74c7c5b-7b00-4b6c-8c01-8b01c0c0c994'");

fs.writeFileSync(file, code);
