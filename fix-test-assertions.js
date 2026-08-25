const fs = require('fs');
const file = 'apps/api/tests/integration/phase26g-gps-consistency.test.ts';
let code = fs.readFileSync(file, 'utf8');

// Live tests
code = code.replace(/res\.body\.error\.code/g, "res.body.detail");

// Offline tests
code = code.replace(/res\.body\.data\.processed/g, "res.body.processed");
code = code.replace(/res\.body\.data\.errors/g, "res.body.errors");

fs.writeFileSync(file, code);
