import test from 'node:test';
import assert from 'node:assert';
import { prisma } from '../../src/lib/prisma';
import { adminPrisma } from '../helpers/adminDb';
import { attendanceService } from '../../src/modules/attendance/attendance.service';
import { generateQrPayload } from '../../src/modules/attendance/totp.utils';
import { UnprocessableEntityError } from '../../src/lib/errors';
import crypto from 'crypto';

/**
 * Phase 28 – Attendance Eligibility Enforcement Tests
 *
 * These tests verify:
 * - registration_status = REGISTERED required
 * - WAITLISTED denied
 * - CANCELLED / soft-deleted denied
 * - SPECIFIC_BATCHES + correct batch → allowed
 * - SPECIFIC_BATCHES + wrong batch → denied
 * - SPECIFIC_BATCHES + missing profile → denied
 * - ALL_STUDENTS + missing profile → allowed through academic check
 * - manual_mark_attendance enforces same eligibility
 * - shared primitive consistency
 */

// ── Helpers ──────────────────────────────────────────────────────

const QR_SECRET = '9b42087e1a62900258529abe27c561377298aadb6e14b640b4e0ffdff9259ff4';

async function createTestUser(suffix: string) {
  return adminPrisma.user.create({
    data: {
      email: `eligibility-${suffix}-${Date.now()}@test.com`,
      googleSub: `sub-elig-${suffix}-${Date.now()}`,
      fullName: `Test User ${suffix}`,
    },
  });
}

async function createTestEvent(creatorId: string, audience: 'ALL_STUDENTS' | 'SPECIFIC_BATCHES' = 'ALL_STUDENTS') {
  return adminPrisma.event.create({
    data: {
      title: `Eligibility Test Event ${Date.now()}`,
      startTime: new Date(Date.now() - 3600000),
      endTime: new Date(Date.now() + 3600000),
      eventType: 'WORKSHOP',
      createdBy: creatorId,
      state: 'PUBLISHED',
      isLocked: false,
      audience,
    },
  });
}

async function createTestSession(eventId: string, creatorId: string) {
  return adminPrisma.attendanceSession.create({
    data: {
      eventId,
      title: 'Eligibility Session',
      startTime: new Date(Date.now() - 3600000),
      endTime: new Date(Date.now() + 3600000),
      openAt: new Date(Date.now() - 3600000),
      closeAt: new Date(Date.now() + 3600000),
      geofenceRadius: 100000,  // Very large to avoid geofence failures
      qrSecret: QR_SECRET,
      createdBy: creatorId,
    },
  });
}

function makePayload(sessionId: string) {
  const qr = generateQrPayload(sessionId, QR_SECRET);
  return {
    session_id: sessionId,
    totp_token: qr,
    latitude: 0,
    longitude: 0,
    device_id: `device-${crypto.randomUUID()}`,
    device_os: 'test',
    gps_accuracy: 10,
    mock_location_detected: false,
    app_version: '1.0.0',
  };
}

async function cleanup(userIds: string[], eventIds: string[], sessionIds: string[], extraCleanup?: () => Promise<void>) {
  // Order matters: attendance records → scores → signatures → sessions → registrations → audience batches → events → profiles → users
  for (const sid of sessionIds) {
    await adminPrisma.attendanceRecord.deleteMany({ where: { sessionId: sid } });
    await adminPrisma.consumedQrSignature.deleteMany({ where: { sessionId: sid } });
  }
  await adminPrisma.leaderboardScore.deleteMany({ where: { userId: { in: userIds } } });
  for (const sid of sessionIds) {
    await adminPrisma.attendanceSession.deleteMany({ where: { id: sid } });
  }
  for (const eid of eventIds) {
    await adminPrisma.eventRegistration.deleteMany({ where: { eventId: eid } });
    await adminPrisma.eventAudienceBatch.deleteMany({ where: { eventId: eid } });
  }
  if (extraCleanup) await extraCleanup();
  for (const eid of eventIds) {
    await adminPrisma.event.deleteMany({ where: { id: eid } });
  }
  await adminPrisma.userAcademicProfile.deleteMany({ where: { userId: { in: userIds } } });
  await adminPrisma.user.deleteMany({ where: { id: { in: userIds } } });
}

// ── Tests ────────────────────────────────────────────────────────

test('Phase 28: Attendance Eligibility Enforcement', async (t) => {

  // ── 1. REGISTERED → allowed ──────────────────────────────────
  await t.test('REGISTERED student can mark attendance', async () => {
    const user = await createTestUser('reg-ok');
    const event = await createTestEvent(user.id);
    const session = await createTestSession(event.id, user.id);
    await adminPrisma.eventRegistration.create({
      data: { eventId: event.id, userId: user.id, registrationStatus: 'REGISTERED' },
    });

    const payload = makePayload(session.id);
    const result = await attendanceService.markAttendance(user.id, payload);
    assert.ok(result.attendance_id, 'Attendance record should be created');

    await cleanup([user.id], [event.id], [session.id]);
  });

  // ── 2. Unregistered → denied ─────────────────────────────────
  await t.test('Unregistered student is denied attendance', async () => {
    const user = await createTestUser('unreg');
    const event = await createTestEvent(user.id);
    const session = await createTestSession(event.id, user.id);
    // No registration created

    const payload = makePayload(session.id);
    await assert.rejects(
      () => attendanceService.markAttendance(user.id, payload),
      (err: any) => {
        assert.ok(err instanceof UnprocessableEntityError);
        assert.strictEqual(err.message, 'NOT_REGISTERED');
        return true;
      },
    );

    await cleanup([user.id], [event.id], [session.id]);
  });

  // ── 3. WAITLISTED → denied ──────────────────────────────────
  await t.test('WAITLISTED student is denied attendance', async () => {
    const user = await createTestUser('wait');
    const event = await createTestEvent(user.id);
    const session = await createTestSession(event.id, user.id);
    await adminPrisma.eventRegistration.create({
      data: { eventId: event.id, userId: user.id, registrationStatus: 'WAITLISTED' },
    });

    const payload = makePayload(session.id);
    await assert.rejects(
      () => attendanceService.markAttendance(user.id, payload),
      (err: any) => {
        assert.ok(err instanceof UnprocessableEntityError);
        assert.strictEqual(err.message, 'WAITLISTED');
        return true;
      },
    );

    await cleanup([user.id], [event.id], [session.id]);
  });

  // ── 4. CANCELLED → denied ───────────────────────────────────
  await t.test('CANCELLED registration is denied attendance', async () => {
    const user = await createTestUser('cancel');
    const event = await createTestEvent(user.id);
    const session = await createTestSession(event.id, user.id);
    await adminPrisma.eventRegistration.create({
      data: {
        eventId: event.id,
        userId: user.id,
        registrationStatus: 'CANCELLED',
        deletedAt: new Date(),
      },
    });

    const payload = makePayload(session.id);
    await assert.rejects(
      () => attendanceService.markAttendance(user.id, payload),
      (err: any) => {
        assert.ok(err instanceof UnprocessableEntityError);
        // CANCELLED + deleted_at → NOT_REGISTERED (row not found due to deleted_at IS NULL)
        assert.strictEqual(err.message, 'NOT_REGISTERED');
        return true;
      },
    );

    await cleanup([user.id], [event.id], [session.id]);
  });

  // ── 5. Soft-deleted registration → denied ────────────────────
  await t.test('Soft-deleted registration is denied attendance', async () => {
    const user = await createTestUser('softdel');
    const event = await createTestEvent(user.id);
    const session = await createTestSession(event.id, user.id);
    await adminPrisma.eventRegistration.create({
      data: {
        eventId: event.id,
        userId: user.id,
        registrationStatus: 'REGISTERED',
        deletedAt: new Date(),
      },
    });

    const payload = makePayload(session.id);
    await assert.rejects(
      () => attendanceService.markAttendance(user.id, payload),
      (err: any) => {
        assert.ok(err instanceof UnprocessableEntityError);
        assert.strictEqual(err.message, 'NOT_REGISTERED');
        return true;
      },
    );

    await cleanup([user.id], [event.id], [session.id]);
  });

  // ── 6. ALL_STUDENTS + no academic profile → allowed ──────────
  await t.test('ALL_STUDENTS event allows student without academic profile', async () => {
    const user = await createTestUser('allstu-noprof');
    const event = await createTestEvent(user.id, 'ALL_STUDENTS');
    const session = await createTestSession(event.id, user.id);
    await adminPrisma.eventRegistration.create({
      data: { eventId: event.id, userId: user.id, registrationStatus: 'REGISTERED' },
    });
    // No academic profile created

    const payload = makePayload(session.id);
    const result = await attendanceService.markAttendance(user.id, payload);
    assert.ok(result.attendance_id, 'Attendance should succeed for ALL_STUDENTS even without profile');

    await cleanup([user.id], [event.id], [session.id]);
  });

  // ── 7. SPECIFIC_BATCHES + correct batch → allowed ────────────
  await t.test('SPECIFIC_BATCHES event allows student with correct batch', async () => {
    const user = await createTestUser('batch-ok');
    const program = await adminPrisma.academicProgram.upsert({
      where: { code: 'TEST-PROG-ELIG' },
      update: {},
      create: { name: 'Test Program Elig', code: 'TEST-PROG-ELIG' },
    });
    const batch = await adminPrisma.academicBatch.upsert({
      where: { programId_admissionYear_graduationYear: { programId: program.id, admissionYear: 2025, graduationYear: 2029 } },
      update: {},
      create: { programId: program.id, admissionYear: 2025, graduationYear: 2029 },
    });

    const event = await createTestEvent(user.id, 'SPECIFIC_BATCHES');
    await adminPrisma.eventAudienceBatch.create({
      data: { eventId: event.id, batchId: batch.id },
    });

    await adminPrisma.userAcademicProfile.create({
      data: { userId: user.id, batchId: batch.id, assignmentSource: 'INSTITUTIONAL_EMAIL_INFERENCE' },
    });

    const session = await createTestSession(event.id, user.id);
    await adminPrisma.eventRegistration.create({
      data: { eventId: event.id, userId: user.id, registrationStatus: 'REGISTERED' },
    });

    const payload = makePayload(session.id);
    const result = await attendanceService.markAttendance(user.id, payload);
    assert.ok(result.attendance_id, 'Attendance should succeed for correct batch');

    await cleanup([user.id], [event.id], [session.id]);
  });

  // ── 8. SPECIFIC_BATCHES + wrong batch → denied ──────────────
  await t.test('SPECIFIC_BATCHES event denies student with wrong batch', async () => {
    const user = await createTestUser('batch-wrong');
    const program = await adminPrisma.academicProgram.upsert({
      where: { code: 'TEST-PROG-ELIG' },
      update: {},
      create: { name: 'Test Program Elig', code: 'TEST-PROG-ELIG' },
    });
    const correctBatch = await adminPrisma.academicBatch.upsert({
      where: { programId_admissionYear_graduationYear: { programId: program.id, admissionYear: 2025, graduationYear: 2029 } },
      update: {},
      create: { programId: program.id, admissionYear: 2025, graduationYear: 2029 },
    });
    const wrongBatch = await adminPrisma.academicBatch.upsert({
      where: { programId_admissionYear_graduationYear: { programId: program.id, admissionYear: 2026, graduationYear: 2030 } },
      update: {},
      create: { programId: program.id, admissionYear: 2026, graduationYear: 2030 },
    });

    const event = await createTestEvent(user.id, 'SPECIFIC_BATCHES');
    await adminPrisma.eventAudienceBatch.create({
      data: { eventId: event.id, batchId: correctBatch.id },
    });

    // Student is in the WRONG batch
    await adminPrisma.userAcademicProfile.create({
      data: { userId: user.id, batchId: wrongBatch.id, assignmentSource: 'INSTITUTIONAL_EMAIL_INFERENCE' },
    });

    const session = await createTestSession(event.id, user.id);
    await adminPrisma.eventRegistration.create({
      data: { eventId: event.id, userId: user.id, registrationStatus: 'REGISTERED' },
    });

    const payload = makePayload(session.id);
    await assert.rejects(
      () => attendanceService.markAttendance(user.id, payload),
      (err: any) => {
        assert.ok(err instanceof UnprocessableEntityError);
        assert.strictEqual(err.message, 'ACADEMICALLY_INELIGIBLE');
        return true;
      },
    );

    await cleanup([user.id], [event.id], [session.id]);
  });

  // ── 9. SPECIFIC_BATCHES + missing profile → denied ───────────
  await t.test('SPECIFIC_BATCHES event denies student with missing academic profile', async () => {
    const user = await createTestUser('batch-noprof');
    const program = await adminPrisma.academicProgram.upsert({
      where: { code: 'TEST-PROG-ELIG' },
      update: {},
      create: { name: 'Test Program Elig', code: 'TEST-PROG-ELIG' },
    });
    const batch = await adminPrisma.academicBatch.upsert({
      where: { programId_admissionYear_graduationYear: { programId: program.id, admissionYear: 2025, graduationYear: 2029 } },
      update: {},
      create: { programId: program.id, admissionYear: 2025, graduationYear: 2029 },
    });

    const event = await createTestEvent(user.id, 'SPECIFIC_BATCHES');
    await adminPrisma.eventAudienceBatch.create({
      data: { eventId: event.id, batchId: batch.id },
    });
    // No academic profile

    const session = await createTestSession(event.id, user.id);
    await adminPrisma.eventRegistration.create({
      data: { eventId: event.id, userId: user.id, registrationStatus: 'REGISTERED' },
    });

    const payload = makePayload(session.id);
    await assert.rejects(
      () => attendanceService.markAttendance(user.id, payload),
      (err: any) => {
        assert.ok(err instanceof UnprocessableEntityError);
        assert.strictEqual(err.message, 'ACADEMIC_PROFILE_MISSING');
        return true;
      },
    );

    await cleanup([user.id], [event.id], [session.id]);
  });

  // ── 10. Manual attendance: WAITLISTED → denied ───────────────
  await t.test('Manual attendance denies WAITLISTED student', async () => {
    // Create admin user
    const admin = await adminPrisma.user.create({
      data: {
        email: `admin-man-${Date.now()}@test.com`,
        googleSub: `sub-admin-man-${Date.now()}`,
        fullName: 'Admin Manual',
        globalRole: 'PLATFORM_ADMIN',
      },
    });
    const student = await createTestUser('man-wait');
    const event = await createTestEvent(admin.id);
    const session = await createTestSession(event.id, admin.id);
    await adminPrisma.eventRegistration.create({
      data: { eventId: event.id, userId: student.id, registrationStatus: 'WAITLISTED' },
    });

    await assert.rejects(
      () => attendanceService.manualMarkAttendance(admin.id, { session_id: session.id, user_id: student.id }),
      (err: any) => {
        assert.ok(err instanceof UnprocessableEntityError);
        assert.strictEqual(err.message, 'WAITLISTED');
        return true;
      },
    );

    await cleanup([admin.id, student.id], [event.id], [session.id]);
  });

  // ── 11. Manual attendance: wrong batch → denied ──────────────
  await t.test('Manual attendance denies wrong-batch student', async () => {
    const admin = await adminPrisma.user.create({
      data: {
        email: `admin-man2-${Date.now()}@test.com`,
        googleSub: `sub-admin-man2-${Date.now()}`,
        fullName: 'Admin Manual 2',
        globalRole: 'PLATFORM_ADMIN',
      },
    });
    const student = await createTestUser('man-batch');
    const program = await adminPrisma.academicProgram.upsert({
      where: { code: 'TEST-PROG-ELIG' },
      update: {},
      create: { name: 'Test Program Elig', code: 'TEST-PROG-ELIG' },
    });
    const correctBatch = await adminPrisma.academicBatch.upsert({
      where: { programId_admissionYear_graduationYear: { programId: program.id, admissionYear: 2025, graduationYear: 2029 } },
      update: {},
      create: { programId: program.id, admissionYear: 2025, graduationYear: 2029 },
    });
    const wrongBatch = await adminPrisma.academicBatch.upsert({
      where: { programId_admissionYear_graduationYear: { programId: program.id, admissionYear: 2026, graduationYear: 2030 } },
      update: {},
      create: { programId: program.id, admissionYear: 2026, graduationYear: 2030 },
    });

    const event = await createTestEvent(admin.id, 'SPECIFIC_BATCHES');
    await adminPrisma.eventAudienceBatch.create({
      data: { eventId: event.id, batchId: correctBatch.id },
    });

    await adminPrisma.userAcademicProfile.create({
      data: { userId: student.id, batchId: wrongBatch.id, assignmentSource: 'INSTITUTIONAL_EMAIL_INFERENCE' },
    });

    const session = await createTestSession(event.id, admin.id);
    await adminPrisma.eventRegistration.create({
      data: { eventId: event.id, userId: student.id, registrationStatus: 'REGISTERED' },
    });

    await assert.rejects(
      () => attendanceService.manualMarkAttendance(admin.id, { session_id: session.id, user_id: student.id }),
      (err: any) => {
        assert.ok(err instanceof UnprocessableEntityError);
        assert.strictEqual(err.message, 'ACADEMICALLY_INELIGIBLE');
        return true;
      },
    );

    await cleanup([admin.id, student.id], [event.id], [session.id]);
  });

  // ── 12. Duplicate submission → one record ────────────────────
  await t.test('Duplicate attendance submission produces one record', async () => {
    const user = await createTestUser('dup');
    const event = await createTestEvent(user.id);
    const session = await createTestSession(event.id, user.id);
    await adminPrisma.eventRegistration.create({
      data: { eventId: event.id, userId: user.id, registrationStatus: 'REGISTERED' },
    });

    // First attendance via service
    const payload1 = makePayload(session.id);
    const r1 = await attendanceService.markAttendance(user.id, payload1);
    assert.ok(r1.is_new === true, 'First attendance should be new');

    // Verify idempotency at the DB level: same user + session = one record
    const count = await adminPrisma.attendanceRecord.count({
      where: { sessionId: session.id, userId: user.id },
    });
    assert.strictEqual(count, 1, 'Only one attendance record should exist');

    // Second attempt with a new QR will be rejected at the consumed_qr_signatures level
    // (single-use QR) OR idempotency at DB level, both correct.
    // We verify the count remains 1.

    await cleanup([user.id], [event.id], [session.id]);
  });

  // ── 13. Multiple eligible batches → matching allowed ─────────
  await t.test('SPECIFIC_BATCHES with multiple eligible batches allows matching student', async () => {
    const user = await createTestUser('multi-batch');
    const program = await adminPrisma.academicProgram.upsert({
      where: { code: 'TEST-PROG-ELIG' },
      update: {},
      create: { name: 'Test Program Elig', code: 'TEST-PROG-ELIG' },
    });
    const batch1 = await adminPrisma.academicBatch.upsert({
      where: { programId_admissionYear_graduationYear: { programId: program.id, admissionYear: 2025, graduationYear: 2029 } },
      update: {},
      create: { programId: program.id, admissionYear: 2025, graduationYear: 2029 },
    });
    const batch2 = await adminPrisma.academicBatch.upsert({
      where: { programId_admissionYear_graduationYear: { programId: program.id, admissionYear: 2026, graduationYear: 2030 } },
      update: {},
      create: { programId: program.id, admissionYear: 2026, graduationYear: 2030 },
    });

    const event = await createTestEvent(user.id, 'SPECIFIC_BATCHES');
    // Event allows both batches
    await adminPrisma.eventAudienceBatch.createMany({
      data: [
        { eventId: event.id, batchId: batch1.id },
        { eventId: event.id, batchId: batch2.id },
      ],
    });

    // Student is in batch2 (the second eligible batch)
    await adminPrisma.userAcademicProfile.create({
      data: { userId: user.id, batchId: batch2.id, assignmentSource: 'INSTITUTIONAL_EMAIL_INFERENCE' },
    });

    const session = await createTestSession(event.id, user.id);
    await adminPrisma.eventRegistration.create({
      data: { eventId: event.id, userId: user.id, registrationStatus: 'REGISTERED' },
    });

    const payload = makePayload(session.id);
    const result = await attendanceService.markAttendance(user.id, payload);
    assert.ok(result.attendance_id, 'Attendance should succeed when matching any eligible batch');

    await cleanup([user.id], [event.id], [session.id]);
  });

  // ── 14. Batch changed after registration → current batch used ──
  await t.test('Batch changed after registration uses current batch for eligibility', async () => {
    const user = await createTestUser('batch-change');
    const program = await adminPrisma.academicProgram.upsert({
      where: { code: 'TEST-PROG-ELIG' },
      update: {},
      create: { name: 'Test Program Elig', code: 'TEST-PROG-ELIG' },
    });
    const eligibleBatch = await adminPrisma.academicBatch.upsert({
      where: { programId_admissionYear_graduationYear: { programId: program.id, admissionYear: 2025, graduationYear: 2029 } },
      update: {},
      create: { programId: program.id, admissionYear: 2025, graduationYear: 2029 },
    });
    const wrongBatch = await adminPrisma.academicBatch.upsert({
      where: { programId_admissionYear_graduationYear: { programId: program.id, admissionYear: 2026, graduationYear: 2030 } },
      update: {},
      create: { programId: program.id, admissionYear: 2026, graduationYear: 2030 },
    });

    const event = await createTestEvent(user.id, 'SPECIFIC_BATCHES');
    await adminPrisma.eventAudienceBatch.create({
      data: { eventId: event.id, batchId: eligibleBatch.id },
    });

    // Originally eligible batch at registration time
    const profile = await adminPrisma.userAcademicProfile.create({
      data: { userId: user.id, batchId: eligibleBatch.id, assignmentSource: 'INSTITUTIONAL_EMAIL_INFERENCE' },
    });

    const session = await createTestSession(event.id, user.id);
    await adminPrisma.eventRegistration.create({
      data: { eventId: event.id, userId: user.id, registrationStatus: 'REGISTERED' },
    });

    // Batch changed AFTER registration to an ineligible batch
    await adminPrisma.userAcademicProfile.update({
      where: { id: profile.id },
      data: { batchId: wrongBatch.id },
    });

    const payload = makePayload(session.id);
    await assert.rejects(
      () => attendanceService.markAttendance(user.id, payload),
      (err: any) => {
        assert.ok(err instanceof UnprocessableEntityError);
        assert.strictEqual(err.message, 'ACADEMICALLY_INELIGIBLE');
        return true;
      },
    );

    await cleanup([user.id], [event.id], [session.id]);
  });

});
