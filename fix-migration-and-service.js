const fs = require('fs');

// 1. Fix service
let serviceFile = 'apps/api/src/modules/attendance/attendance.service.ts';
let serviceCode = fs.readFileSync(serviceFile, 'utf8');
serviceCode = serviceCode.replace(
  "SELECT sync_offline_attendance(${sessionId}::uuid, ${recordsJson}::jsonb) as result",
  "SELECT sync_offline_attendance(${recordsJson}::jsonb) as result"
);
fs.writeFileSync(serviceFile, serviceCode);

// 2. Fix migration
let migrationFile = 'packages/database/prisma/migrations/20260823100000_phase26e_collision_hardening/migration.sql';
let migrationCode = fs.readFileSync(migrationFile, 'utf8');

migrationCode = migrationCode.replace(
  "CREATE OR REPLACE FUNCTION sync_offline_attendance(\n  p_session_id UUID,\n  p_payloads JSONB\n)",
  "CREATE OR REPLACE FUNCTION sync_offline_attendance(\n  p_payloads JSONB\n)"
);

migrationCode = migrationCode.replace(
  /p_session_id/g,
  "v_session_id"
);

// We need to make sure v_session_id is extracted!
// Add v_session_id to DECLARE
if (!migrationCode.includes("v_session_id UUID;")) {
  migrationCode = migrationCode.replace(
    "v_event_id UUID;",
    "v_session_id UUID;\n  v_event_id UUID;"
  );
}

// Add the extraction inside the loop!
migrationCode = migrationCode.replace(
  "BEGIN\n      v_user_id := (v_payload->>'user_id')::UUID;",
  "BEGIN\n      v_session_id := (v_payload->>'session_id')::UUID;\n      v_user_id := (v_payload->>'user_id')::UUID;"
);

// Remove the DROP FUNCTION IF EXISTS sync_offline_attendance(JSONB) that I added before
migrationCode = migrationCode.replace("DROP FUNCTION IF EXISTS sync_offline_attendance(JSONB);\n\n", "");

fs.writeFileSync(migrationFile, migrationCode);
