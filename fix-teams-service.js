const fs = require('fs');
const path = 'apps/api/src/modules/admin/teams.service.ts';
let code = fs.readFileSync(path, 'utf8');
code = code.replace(/metadata: \{/g, "newState: {");
fs.writeFileSync(path, code);
