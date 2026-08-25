const fs = require('fs');
const path = 'apps/api/src/modules/admin/teams.service.ts';
let code = fs.readFileSync(path, 'utf8');
code = code.replace(/newState: \{\n            schema_version: 1,/g, "metadata: {\n            schema_version: 1,");
fs.writeFileSync(path, code);
