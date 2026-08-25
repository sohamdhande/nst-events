const fs = require('fs');
const path = 'packages/database/prisma/migrations/20260824140000_ui_14i_team_remediation/migration.sql';
let content = fs.readFileSync(path, 'utf8');

const drops = `
DROP FUNCTION IF EXISTS create_team(UUID, TEXT);
DROP FUNCTION IF EXISTS join_team(UUID, UUID);
DROP FUNCTION IF EXISTS accept_invitation(UUID, UUID, UUID);
DROP FUNCTION IF EXISTS process_waitlist(UUID);
DROP FUNCTION IF EXISTS cancel_team(UUID, UUID);
DROP FUNCTION IF EXISTS leave_team(UUID, UUID, UUID);
DROP FUNCTION IF EXISTS transfer_leadership(UUID, UUID, UUID);

`;

content = content.replace('-- RPC REPLACEMENTS for UI-14I', drops + '-- RPC REPLACEMENTS for UI-14I');
fs.writeFileSync(path, content);
