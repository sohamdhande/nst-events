const fs = require('fs');
const file = 'packages/database/prisma/migrations/20260823100000_phase26e_collision_hardening/migration.sql';
let code = fs.readFileSync(file, 'utf8');

// Fix mark_attendance signature
code = code.replace(
  "CREATE OR REPLACE FUNCTION mark_attendance(\n  v_session_id UUID,",
  "CREATE OR REPLACE FUNCTION mark_attendance(\n  p_session_id UUID,"
);

// Fix mark_attendance body references
const markAttendanceBodyStart = code.indexOf("CREATE OR REPLACE FUNCTION mark_attendance");
const syncOfflineStart = code.indexOf("CREATE OR REPLACE FUNCTION sync_offline_attendance");

if (markAttendanceBodyStart !== -1 && syncOfflineStart !== -1) {
  let markBody = code.substring(markAttendanceBodyStart, syncOfflineStart);
  markBody = markBody.replace(/v_session_id/g, "p_session_id");
  code = code.substring(0, markAttendanceBodyStart) + markBody + code.substring(syncOfflineStart);
}

fs.writeFileSync(file, code);
