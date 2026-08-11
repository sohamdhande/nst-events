import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { Client } from 'pg';



import { prisma } from '../../src/lib/prisma';
import { getEventRegistrations } from '../../src/modules/registrations/registrations.service';
import { attendanceService } from '../../src/modules/attendance/attendance.service';
import { withUserContext } from '@nst/database';
import { randomUUID } from 'crypto';

describe('Phase 15C: Application-Role RLS Enforcement', () => {
  let adminId = randomUUID();
  let studentId = randomUUID();
  let eventA = randomUUID();
  let eventB = randomUUID();
  let clubId = randomUUID();
  let sessionA = randomUUID();
  let sessionB = randomUUID();
  let disputeA = randomUUID();
  let registrationAId = randomUUID();

  // Setup connection using postgres superuser
  const pgClient = new Client({ connectionString: "postgresql://postgres:postgres@localhost:5440/nst_events?schema=public" });

  before(async () => {
    // 1. Verify connection is nst_app for tests
    const [role] = await prisma.$queryRaw<{ current_user: string, session_user: string }[]>`
      SELECT current_user, session_user;
    `;
    assert.strictEqual(role.current_user, 'nst_app', 'Tests must run as nst_app, not postgres');
    assert.strictEqual(role.session_user, 'nst_app');

    // 2. Setup Fixtures as postgres
    await pgClient.connect();
    
    await pgClient.query(`
      INSERT INTO users (id, email, google_sub, full_name, global_role) VALUES 
      ($1, 'admin@test.com', 'g_sub_c1', 'Admin User', 'STUDENT'),
      ($2, 'student@test.com', 'g_sub_c2', 'Student User', 'STUDENT');
    `, [adminId, studentId]);

    await pgClient.query(`
      INSERT INTO clubs (id, name, status) VALUES ($1, 'Test Club', 'ACTIVE');
    `, [clubId]);

    await pgClient.query(`
      INSERT INTO club_memberships (id, club_id, user_id, role) VALUES 
      (gen_random_uuid(), $1, $2, 'CLUB_ADMIN');
    `, [clubId, adminId]);

    await pgClient.query(`
      INSERT INTO events (id, title, state, visibility, registration_type, attendance_type, created_by, start_time, end_time, event_type) VALUES 
      ($1, 'Event A', 'PUBLISHED', 'PUBLIC', 'INDIVIDUAL', 'SINGLE', $3, now(), now() + interval '1 hour', 'WORKSHOP'),
      ($2, 'Event B', 'PUBLISHED', 'PUBLIC', 'INDIVIDUAL', 'SINGLE', $3, now(), now() + interval '1 hour', 'WORKSHOP');
    `, [eventA, eventB, adminId]);

    await pgClient.query(`
      INSERT INTO event_clubs (event_id, club_id, is_primary) VALUES 
      ($1, $3, true),
      ($2, $3, true);
    `, [eventA, eventB, clubId]);

    await pgClient.query(`
      INSERT INTO event_registrations (id, event_id, user_id, registration_status) VALUES 
      ($1, $2, $3, 'REGISTERED');
    `, [registrationAId, eventA, studentId]);

    await pgClient.query(`
      INSERT INTO attendance_sessions (id, event_id, title, start_time, end_time, open_at, close_at, qr_secret) VALUES 
      ($1, $2, 'Session A', now(), now() + interval '1 hour', now(), now() + interval '1 hour', 'test_qr_secret_a'), 
      ($3, $4, 'Session B', now(), now() + interval '1 hour', now(), now() + interval '1 hour', 'test_qr_secret_b');
    `, [sessionA, eventA, sessionB, eventB]);

    await pgClient.query(`
      INSERT INTO attendance_records (id, user_id, session_id, status, method) VALUES 
      (gen_random_uuid(), $1, $2, 'PRESENT', 'QR');
    `, [studentId, sessionA]);

    await pgClient.query(`
      INSERT INTO attendance_disputes (id, user_id, session_id, event_id, reason, status, dispute_window_expires_at) VALUES 
      ($1, $2, $3, $4, 'Dispute A', 'PENDING', now() + interval '1 day');
    `, [disputeA, studentId, sessionA, eventA]);
  });

  after(async () => {
    // Cleanup
    await pgClient.query(`DELETE FROM attendance_disputes WHERE id = $1`, [disputeA]);
    await pgClient.query(`DELETE FROM attendance_records WHERE user_id = $1`, [studentId]);
    await pgClient.query(`DELETE FROM attendance_sessions WHERE id IN ($1, $2)`, [sessionA, sessionB]);
    await pgClient.query(`DELETE FROM event_registrations WHERE id = $1`, [registrationAId]);
    await pgClient.query(`DELETE FROM event_clubs WHERE event_id IN ($1, $2)`, [eventA, eventB]);
    await pgClient.query(`DELETE FROM events WHERE id IN ($1, $2)`, [eventA, eventB]);
    await pgClient.query(`DELETE FROM club_memberships WHERE club_id = $1`, [clubId]);
    await pgClient.query(`DELETE FROM clubs WHERE id = $1`, [clubId]);
    await pgClient.query(`DELETE FROM users WHERE id IN ($1, $2)`, [adminId, studentId]);
    
    await pgClient.end();
  });

  it('verifies RLS transaction-local context', async () => {
    const outside = await prisma.$queryRaw<any[]>`SELECT current_user_id() as uid`;
    assert.strictEqual(outside[0].uid, null);

    await withUserContext(adminId, async (tx) => {
      const inside = await tx.$queryRaw<any[]>`SELECT current_user_id() as uid`;
      assert.strictEqual(inside[0].uid, adminId);
    });

    const afterTx = await prisma.$queryRaw<any[]>`SELECT current_user_id() as uid`;
    assert.strictEqual(afterTx[0].uid, null);
  });

  it('proves nst_app cannot access records without context', async () => {
    // RLS should block nst_app from seeing registrations without context
    const records = await prisma.eventRegistration.findMany({ where: { eventId: eventA } });
    assert.strictEqual(records.length, 0);
  });

  it('Admin authorized read test', async () => {
    // Admin is a club admin for Event A, so they should see the registration
    const regs = await getEventRegistrations(adminId, eventA, 10);
    assert.strictEqual(regs.data.length, 1);
    assert.strictEqual(regs.data[0].userId, studentId);

    const attendance = await attendanceService.getEventAttendance(adminId, eventA, { limit: 10 });
    assert.strictEqual(attendance.data.length, 1);

    const disputes = await attendanceService.getAttendanceDisputes(adminId, eventA, { limit: 10 });
    assert.strictEqual(disputes.data.length, 1);
  });

  it('Unauthorized read test (cross-event & unauthorized user)', async () => {
    // Student should not see ALL event registrations (RLS restricts to only their own)
    // Wait, the API contract uses getEventRegistrations which only returns registrations for the event
    const regs = await getEventRegistrations(studentId, eventA, 10);
    // Student can only see their own registration
    assert.strictEqual(regs.data.length, 1);

    const attendance = await attendanceService.getEventAttendance(studentId, eventA, { limit: 10 });
    // Same for attendance
    assert.strictEqual(attendance.data.length, 1);
    
    const disputes = await attendanceService.getAttendanceDisputes(studentId, eventA, { limit: 10 });
    // Student can see their own dispute
    assert.strictEqual(disputes.data.length, 1);

    // Now test a completely unauthorized user (another student)
    const randomUser = randomUUID();
    await pgClient.query(`INSERT INTO users (id, email, google_sub, full_name, global_role) VALUES ($1, 'rand@test.com', 'r_sub', 'Rand', 'STUDENT')`, [randomUser]);
    
    const regsUnauthorized = await getEventRegistrations(randomUser, eventA, 10);
    assert.strictEqual(regsUnauthorized.data.length, 0);

    const attUnauthorized = await attendanceService.getEventAttendance(randomUser, eventA, { limit: 10 });
    assert.strictEqual(attUnauthorized.data.length, 0);

    const dispUnauthorized = await attendanceService.getAttendanceDisputes(randomUser, eventA, { limit: 10 });
    assert.strictEqual(dispUnauthorized.data.length, 0);
    
    await pgClient.query(`DELETE FROM users WHERE id = $1`, [randomUser]);
  });
  
  it('Phase 15A Regression Verification', async () => {
    // As nst_app, attempting to modify global_role should be blocked
    let errorCaught = false;
    try {
      await withUserContext(studentId, async (tx) => {
        await tx.$executeRaw`
          UPDATE users SET global_role = 'PLATFORM_ADMIN' WHERE id = ${studentId}::uuid;
        `;
      });
    } catch (e: any) {
      errorCaught = true;
      assert.ok(e.message.includes('Unauthorized modification of global_role') || e.message.includes('Unauthorized: global_role is immutable to the application database role.'));
    }
    assert.ok(errorCaught, 'Phase 15A trigger did not fire for nst_app');
  });
});
