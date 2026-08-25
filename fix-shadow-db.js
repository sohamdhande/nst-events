const fs = require('fs');
const file = 'packages/database/prisma/migrations/20260823100000_phase26e_collision_hardening/migration.sql';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  "-- 2. Modify sync_offline_attendance\nCREATE OR REPLACE FUNCTION sync_offline_attendance(",
  "-- 2. Modify sync_offline_attendance\nDROP FUNCTION IF EXISTS sync_offline_attendance(jsonb);\nCREATE OR REPLACE FUNCTION sync_offline_attendance("
);

fs.writeFileSync(file, code);
