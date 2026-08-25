const fs = require('fs');
const file = 'apps/api/tests/integration/phase26g-gps-consistency.test.ts';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  "assert.strictEqual(res.status, 201);",
  "if (res.status !== 201) console.error('LIVE SUCCESS TEST FAILED:', res.body);\n    assert.strictEqual(res.status, 201);"
);

fs.writeFileSync(file, code);
