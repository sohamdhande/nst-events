const fs = require('fs');
const file = 'apps/api/tests/setup.ts';
let code = fs.readFileSync(file, 'utf8');
code = code.replace("postgresql://nst_app:new_secure_nst_app_password_987@localhost:5440/nst_events?schema=public", "postgresql://postgres:postgres@localhost:5440/nst_events?schema=public");
fs.writeFileSync(file, code);
