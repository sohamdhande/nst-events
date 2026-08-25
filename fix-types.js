const fs = require('fs');

const usersServicePath = 'apps/api/src/modules/admin/users.service.ts';
let usersService = fs.readFileSync(usersServicePath, 'utf8');
usersService = usersService.replace(/'ADMIN'/g, "'ADMIN_OVERRIDE'");
usersService = usersService.replace(/"ADMIN"/g, "'ADMIN_OVERRIDE'");
fs.writeFileSync(usersServicePath, usersService);

const authServicePath = 'apps/api/src/modules/auth/auth.service.ts';
let authService = fs.readFileSync(authServicePath, 'utf8');
authService = authService.replace(/'EMAIL_INFERENCE'/g, "'INSTITUTIONAL_EMAIL_INFERENCE'");
authService = authService.replace(/"EMAIL_INFERENCE"/g, "'INSTITUTIONAL_EMAIL_INFERENCE'");
fs.writeFileSync(authServicePath, authService);

const adminTeamsServicePath = 'apps/api/src/modules/admin/teams.service.ts';
let adminTeamsService = fs.readFileSync(adminTeamsServicePath, 'utf8');
adminTeamsService = adminTeamsService.replace(/eventId: team\.eventId,/g, "");
fs.writeFileSync(adminTeamsServicePath, adminTeamsService);
