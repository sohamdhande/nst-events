import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import { createApp } from '../../src/app';
import { adminPrisma } from '../helpers/adminDb';
import { signJwt } from '../../src/lib/jwt';
import { randomUUID } from 'crypto';
import { generateQrPayload } from '../../src/modules/attendance/totp.utils';

const app = createApp();

describe('Own-Event Club Admin Participation & Attendance Restriction', { concurrency: false }, () => {
  let studentUserId = randomUUID();
  let clubAdminUserId = randomUUID();
  let multiClubAdminUserId = randomUUID();
  let clubMemberUserId = randomUUID();

  let clubAId = randomUUID();
  let clubBId = randomUUID();

  let eventAId = randomUUID(); // Organized by Club A (Primary)
  let eventBId = randomUUID(); // Organized by Club B (Primary)

  let sessionAId = randomUUID(); // Session for Event A
  let sessionBId = randomUUID(); // Session for Event B
  let qrSecretA = 'secret_test_key_a';
  let qrSecretB = 'secret_test_key_b';

  let studentToken: string;
  let clubAdminToken: string;
  let multiClubAdminToken: string;
  let clubMemberToken: string;

  before(async () => {
    // 1. Users
    await adminPrisma.$executeRaw`
      INSERT INTO users (id, email, google_sub, full_name, global_role) VALUES 
      (${studentUserId}::uuid, ${'std_' + studentUserId + '@test.com'}, ${'sub_std_' + studentUserId}, 'Regular Student', 'STUDENT'),
      (${clubAdminUserId}::uuid, ${'ca_a_' + clubAdminUserId + '@test.com'}, ${'sub_ca_a_' + clubAdminUserId}, 'Club Admin A', 'STUDENT'),
      (${multiClubAdminUserId}::uuid, ${'ca_ab_' + multiClubAdminUserId + '@test.com'}, ${'sub_ca_ab_' + multiClubAdminUserId}, 'Multi Club Admin', 'STUDENT'),
      (${clubMemberUserId}::uuid, ${'cm_a_' + clubMemberUserId + '@test.com'}, ${'sub_cm_a_' + clubMemberUserId}, 'Club Member A', 'STUDENT');
    `;

    // 2. Clubs
    await adminPrisma.$executeRaw`
      INSERT INTO clubs (id, name, status) VALUES 
      (${clubAId}::uuid, 'OwnEvent Club A ' || gen_random_uuid()::text, 'ACTIVE'),
      (${clubBId}::uuid, 'OwnEvent Club B ' || gen_random_uuid()::text, 'ACTIVE');
    `;

    // 3. Memberships
    await adminPrisma.$executeRaw`
      INSERT INTO club_memberships (id, club_id, user_id, role) VALUES 
      (gen_random_uuid(), ${clubAId}::uuid, ${clubAdminUserId}::uuid, 'CLUB_ADMIN'),
      (gen_random_uuid(), ${clubAId}::uuid, ${multiClubAdminUserId}::uuid, 'CLUB_ADMIN'),
      (gen_random_uuid(), ${clubBId}::uuid, ${multiClubAdminUserId}::uuid, 'CLUB_ADMIN'),
      (gen_random_uuid(), ${clubAId}::uuid, ${clubMemberUserId}::uuid, 'MEMBER');
    `;

    // 4. Events
    await adminPrisma.$executeRaw`
      INSERT INTO events (id, title, start_time, end_time, event_type, created_by, state, visibility, registration_type, attendance_type, audience) 
      VALUES 
      (${eventAId}::uuid, 'Event A (Club A)', now(), now() + interval '2 hours', 'WORKSHOP', ${clubAdminUserId}::uuid, 'PUBLISHED', 'PUBLIC', 'INDIVIDUAL', 'SINGLE', 'ALL_STUDENTS'),
      (${eventBId}::uuid, 'Event B (Club B)', now(), now() + interval '2 hours', 'WORKSHOP', ${multiClubAdminUserId}::uuid, 'PUBLISHED', 'PUBLIC', 'INDIVIDUAL', 'SINGLE', 'ALL_STUDENTS');
    `;

    await adminPrisma.$executeRaw`
      INSERT INTO event_clubs (event_id, club_id, is_primary) VALUES 
      (${eventAId}::uuid, ${clubAId}::uuid, true),
      (${eventBId}::uuid, ${clubBId}::uuid, true);
    `;

    // 5. Attendance Sessions
    await adminPrisma.$executeRaw`
      INSERT INTO attendance_sessions (id, event_id, title, start_time, end_time, open_at, close_at, qr_secret, created_by) 
      VALUES 
      (${sessionAId}::uuid, ${eventAId}::uuid, 'Session A', now() - interval '5 min', now() + interval '1 hour', now() - interval '5 min', now() + interval '1 hour', ${qrSecretA}, ${clubAdminUserId}::uuid),
      (${sessionBId}::uuid, ${eventBId}::uuid, 'Session B', now() - interval '5 min', now() + interval '1 hour', now() - interval '5 min', now() + interval '1 hour', ${qrSecretB}, ${multiClubAdminUserId}::uuid);
    `;

    // 6. Pre-register Regular Student & Club Member for Event A, and Club Admin A for Event B (with snapshot)
    await adminPrisma.$executeRaw`
      INSERT INTO event_registrations (id, event_id, user_id, registration_status, eligibility_scope_snapshot) VALUES 
      (gen_random_uuid(), ${eventAId}::uuid, ${studentUserId}::uuid, 'REGISTERED', 'ALL_STUDENTS'),
      (gen_random_uuid(), ${eventAId}::uuid, ${clubMemberUserId}::uuid, 'REGISTERED', 'ALL_STUDENTS'),
      (gen_random_uuid(), ${eventBId}::uuid, ${clubAdminUserId}::uuid, 'REGISTERED', 'ALL_STUDENTS');
    `;

    studentToken = signJwt(studentUserId);
    clubAdminToken = signJwt(clubAdminUserId);
    multiClubAdminToken = signJwt(multiClubAdminUserId);
    clubMemberToken = signJwt(clubMemberUserId);
  });

  after(async () => {
    await adminPrisma.$executeRaw`DELETE FROM leaderboard_scores WHERE user_id IN (${studentUserId}::uuid, ${clubAdminUserId}::uuid, ${multiClubAdminUserId}::uuid, ${clubMemberUserId}::uuid);`;
    await adminPrisma.$executeRaw`DELETE FROM attendance_records WHERE session_id IN (${sessionAId}::uuid, ${sessionBId}::uuid);`;
    await adminPrisma.$executeRaw`DELETE FROM attendance_sessions WHERE id IN (${sessionAId}::uuid, ${sessionBId}::uuid);`;
    await adminPrisma.$executeRaw`DELETE FROM event_registrations WHERE event_id IN (${eventAId}::uuid, ${eventBId}::uuid);`;
    await adminPrisma.$executeRaw`DELETE FROM event_clubs WHERE event_id IN (${eventAId}::uuid, ${eventBId}::uuid);`;
    await adminPrisma.$executeRaw`DELETE FROM events WHERE id IN (${eventAId}::uuid, ${eventBId}::uuid);`;
    await adminPrisma.$executeRaw`DELETE FROM club_memberships WHERE club_id IN (${clubAId}::uuid, ${clubBId}::uuid);`;
    await adminPrisma.$executeRaw`DELETE FROM clubs WHERE id IN (${clubAId}::uuid, ${clubBId}::uuid);`;
    await adminPrisma.$executeRaw`DELETE FROM users WHERE id IN (${studentUserId}::uuid, ${clubAdminUserId}::uuid, ${multiClubAdminUserId}::uuid, ${clubMemberUserId}::uuid);`;
  });

  it('1. Regular STUDENT marking attendance -> Allowed (201/200)', async () => {
    const totpToken = generateQrPayload(sessionAId, qrSecretA);
    const res = await request(app)
      .post('/v1/attendance/mark')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        session_id: sessionAId,
        totp_token: totpToken,
        latitude: 28.5355,
        longitude: 77.3910,
        device_id: 'device_std_01',
        device_os: 'android',
        gps_accuracy: 5.0,
        mock_location_detected: false,
        app_version: '1.0.0',
      });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.status, 'PRESENT');
  });

  it('2. Primary CLUB_ADMIN registering for own event -> Blocked (422 REGISTRATION_NOT_ELIGIBLE)', async () => {
    const res = await request(app)
      .post(`/v1/events/${eventAId}/register`)
      .set('Authorization', `Bearer ${clubAdminToken}`)
      .send();

    assert.strictEqual(res.status, 422);
    const bodyStr = JSON.stringify(res.body);
    assert.ok(bodyStr.includes('Primary Club Admin cannot participate in their own event') || bodyStr.includes('REGISTRATION_NOT_ELIGIBLE'));
  });

  it('3. Primary CLUB_ADMIN marking attendance for own event -> Blocked (422 REGISTRATION_NOT_ELIGIBLE)', async () => {
    const dummyRegId = randomUUID();
    await adminPrisma.$executeRaw`
      INSERT INTO event_registrations (id, event_id, user_id, registration_status, eligibility_scope_snapshot) VALUES 
      (${dummyRegId}::uuid, ${eventAId}::uuid, ${clubAdminUserId}::uuid, 'REGISTERED', 'ALL_STUDENTS');
    `;

    const totpToken = generateQrPayload(sessionAId, qrSecretA);
    const res = await request(app)
      .post('/v1/attendance/mark')
      .set('Authorization', `Bearer ${clubAdminToken}`)
      .send({
        session_id: sessionAId,
        totp_token: totpToken,
        latitude: 28.5355,
        longitude: 77.3910,
        device_id: 'device_ca_01',
        device_os: 'android',
        gps_accuracy: 5.0,
        mock_location_detected: false,
        app_version: '1.0.0',
      });

    assert.strictEqual(res.status, 422);
    const bodyStr = JSON.stringify(res.body);
    assert.ok(bodyStr.includes('Primary Club Admin cannot participate in their own event') || bodyStr.includes('REGISTRATION_NOT_ELIGIBLE'));

    await adminPrisma.$executeRaw`DELETE FROM event_registrations WHERE id = ${dummyRegId}::uuid;`;
  });

  it('4. STUDENT + CLUB_ADMIN of Club A marking attendance for Club B event -> Allowed (201/200)', async () => {
    const totpToken = generateQrPayload(sessionBId, qrSecretB);
    const res = await request(app)
      .post('/v1/attendance/mark')
      .set('Authorization', `Bearer ${clubAdminToken}`)
      .send({
        session_id: sessionBId,
        totp_token: totpToken,
        latitude: 28.5355,
        longitude: 77.3910,
        device_id: 'device_ca_02',
        device_os: 'android',
        gps_accuracy: 5.0,
        mock_location_detected: false,
        app_version: '1.0.0',
      });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.status, 'PRESENT');
  });

  it('5. STUDENT + normal MEMBER of Club A marking attendance for Club A event -> Allowed (201/200)', async () => {
    const totpToken = generateQrPayload(sessionAId, qrSecretA);
    const res = await request(app)
      .post('/v1/attendance/mark')
      .set('Authorization', `Bearer ${clubMemberToken}`)
      .send({
        session_id: sessionAId,
        totp_token: totpToken,
        latitude: 28.5355,
        longitude: 77.3910,
        device_id: 'device_cm_01',
        device_os: 'android',
        gps_accuracy: 5.0,
        mock_location_detected: false,
        app_version: '1.0.0',
      });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.status, 'PRESENT');
  });

  it('6. Multi-club admin for Club A & Club B -> Blocked for Event A, Blocked for Event B', async () => {
    const regAId = randomUUID();
    const regBId = randomUUID();
    await adminPrisma.$executeRaw`
      INSERT INTO event_registrations (id, event_id, user_id, registration_status, eligibility_scope_snapshot) VALUES 
      (${regAId}::uuid, ${eventAId}::uuid, ${multiClubAdminUserId}::uuid, 'REGISTERED', 'ALL_STUDENTS'),
      (${regBId}::uuid, ${eventBId}::uuid, ${multiClubAdminUserId}::uuid, 'REGISTERED', 'ALL_STUDENTS');
    `;

    const totpTokenA = generateQrPayload(sessionAId, qrSecretA);
    const resA = await request(app)
      .post('/v1/attendance/mark')
      .set('Authorization', `Bearer ${multiClubAdminToken}`)
      .send({
        session_id: sessionAId,
        totp_token: totpTokenA,
        latitude: 28.5355,
        longitude: 77.3910,
        device_id: 'device_multi_01',
        device_os: 'android',
        gps_accuracy: 5.0,
        mock_location_detected: false,
        app_version: '1.0.0',
      });

    assert.strictEqual(resA.status, 422);
    const bodyStrA = JSON.stringify(resA.body);
    assert.ok(bodyStrA.includes('Primary Club Admin cannot participate in their own event') || bodyStrA.includes('REGISTRATION_NOT_ELIGIBLE'));

    const totpTokenB = generateQrPayload(sessionBId, qrSecretB);
    const resB = await request(app)
      .post('/v1/attendance/mark')
      .set('Authorization', `Bearer ${multiClubAdminToken}`)
      .send({
        session_id: sessionBId,
        totp_token: totpTokenB,
        latitude: 28.5355,
        longitude: 77.3910,
        device_id: 'device_multi_02',
        device_os: 'android',
        gps_accuracy: 5.0,
        mock_location_detected: false,
        app_version: '1.0.0',
      });

    assert.strictEqual(resB.status, 422);
    const bodyStrB = JSON.stringify(resB.body);
    assert.ok(bodyStrB.includes('Primary Club Admin cannot participate in their own event') || bodyStrB.includes('REGISTRATION_NOT_ELIGIBLE'));

    await adminPrisma.$executeRaw`DELETE FROM event_registrations WHERE id IN (${regAId}::uuid, ${regBId}::uuid);`;
  });
});
