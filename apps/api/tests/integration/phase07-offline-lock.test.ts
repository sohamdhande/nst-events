import { describe, it, before, after } from 'node:test';
import * as assert from 'node:assert';
import { adminPrisma } from '../helpers/adminDb';
import { generateQrPayload } from '../../src/modules/attendance/totp.utils';
import { AttendanceService } from '../../src/modules/attendance/attendance.service';
import * as totpUtils from '../../src/modules/attendance/totp.utils';
import crypto from 'crypto';
import sinon from 'sinon';

describe('ATTENDANCE-07: Offline Attendance 24-Hour Lock Time Correction', () => {
  let eventId: string;
  let sessionId: string;
  let studentAId: string;
  let studentBId: string;
  let secret: string;

  const attendanceService = new AttendanceService();
  
  // Event lock boundary definitions
  let eventEndTimeMs: number;
  let lockBoundaryMs: number;
  let earlyScanMs: number;
  let lateScanMs: number;

  before(async () => {
    // Clear out potential leftovers from failed runs
    await adminPrisma.leaderboardScore.deleteMany({
      where: { user: { email: { in: ['studentA_phase07@nst.com', 'studentB_phase07@nst.com'] } } }
    });
    await adminPrisma.user.deleteMany({
      where: { email: { in: ['studentA_phase07@nst.com', 'studentB_phase07@nst.com'] } }
    });

    // Create users
    const studentA = await adminPrisma.user.create({ data: { id: crypto.randomUUID(), email: 'studentA_phase07@nst.com', fullName: 'Student A', globalRole: 'STUDENT', googleSub: 'subA_07' } });
    const studentB = await adminPrisma.user.create({ data: { id: crypto.randomUUID(), email: 'studentB_phase07@nst.com', fullName: 'Student B', globalRole: 'STUDENT', googleSub: 'subB_07' } });

    studentAId = studentA.id;
    studentBId = studentB.id;

    // Temporal semantics
    eventEndTimeMs = Date.now() - 30 * 24 * 60 * 60 * 1000; // Event ended 30 days ago
    lockBoundaryMs = eventEndTimeMs + 24 * 60 * 60 * 1000; // 29 days ago
    
    const event = await adminPrisma.event.create({
      data: {
        id: crypto.randomUUID(),
        title: 'Offline Time Lock Event',
        description: 'Test',
        state: 'PUBLISHED',
        visibility: 'PUBLIC',
        registrationType: 'INDIVIDUAL',
        attendanceType: 'SINGLE',
        audience: 'ALL_STUDENTS',
        eventType: 'MEETUP',
        createdBy: studentAId,
        startTime: new Date(Date.now() - 40 * 60 * 60 * 1000), // 40 hours ago
        endTime: new Date(Date.now() - 30 * 60 * 60 * 1000), // 30 hours ago (Event ended 30 hours ago!)
      }
    });
    eventId = event.id;

    // Register both
    await adminPrisma.eventRegistration.createMany({
      data: [
        { eventId, userId: studentAId, registrationStatus: 'REGISTERED' },
        { eventId, userId: studentBId, registrationStatus: 'REGISTERED' }
      ]
    });

    // Create session
    secret = 'secure_secret_07';
    const session = await adminPrisma.attendanceSession.create({
      data: {
        id: crypto.randomUUID(),
        eventId,
        title: 'Main Session',
        qrSecret: secret,
        openAt: new Date(Date.now() - 35 * 60 * 60 * 1000),
        closeAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
        startTime: new Date(Date.now() - 35 * 60 * 60 * 1000),
        endTime: new Date(Date.now() - 25 * 60 * 60 * 1000),
        geofenceRadius: 50,
        venueLatitude: 10,
        venueLongitude: 10,
        createdBy: studentAId
      }
    });
    sessionId = session.id;

    // Temporal semantics
    eventEndTimeMs = event.endTime.getTime();
    lockBoundaryMs = eventEndTimeMs + 24 * 60 * 60 * 1000; // 6 hours ago
    
    // We stub verifyQrPayload to always return true, so we can test the database 24-hour lock behavior
    // across arbitrary times without worrying about Node's Date.now() rejecting the TOTP signatures.
    sinon.stub(totpUtils, 'verifyQrPayload').returns(true);
  });

  after(async () => {
    sinon.restore();
    await adminPrisma.leaderboardScore.deleteMany({ where: { userId: { in: [studentAId, studentBId] } } });
    await adminPrisma.attendanceRecord.deleteMany({ where: { sessionId } });
    await adminPrisma.consumedQrSignature.deleteMany({ where: { sessionId } });
    await adminPrisma.attendanceSession.deleteMany({ where: { id: sessionId } });
    await adminPrisma.eventRegistration.deleteMany({ where: { eventId } });
    await adminPrisma.event.deleteMany({ where: { id: eventId } });
    await adminPrisma.user.deleteMany({ where: { id: { in: [studentAId, studentBId] } } });
  });

  const runSync = async (callerId: string, scanTimeMs: number) => {
    return attendanceService.syncOffline(callerId, {
      records: [{
        user_id: callerId,
        session_id: sessionId,
        scanned_token: 'mocked_signature',
        scan_timestamp: new Date(scanTimeMs).toISOString(),
        device_id: 'test_device_' + crypto.randomUUID(),
        gps_lat: 10,
        gps_lng: 10,
        gps_accuracy: 10,
        mock_location_detected: false,
        offline_seq: 1
      }]
    });
  };

  it('1. Valid Late Sync (Primary Bug Fix): Scan < event_end + 24h, Sync > event_end + 24h -> ACCEPTED', async () => {
    // Scan occurred 20 hours after event end (so it's BEFORE the 24h lock)
    // But the current db time (sync time) is 30 hours after event end (AFTER the 24h lock)
    const scanTimeMs = eventEndTimeMs + 20 * 60 * 60 * 1000; 
    
    const res = await runSync(studentAId, scanTimeMs);
    assert.strictEqual(res.errors.length, 0);
    assert.strictEqual(res.processed, 1);
  });

  it('2. Scan exactly at 24h boundary: Scan = event_end + 24h -> EVENT_LOCKED', async () => {
    const scanTimeMs = eventEndTimeMs + 24 * 60 * 60 * 1000;
    
    const res = await runSync(studentBId, scanTimeMs);
    assert.strictEqual(res.processed, 0);
    assert.strictEqual(res.errors[0].error_code, 'EVENT_LOCKED', 'Exact boundary must follow >= semantics and reject');
  });

  it('3. Scan after 24h boundary: Scan > event_end + 24h -> EVENT_LOCKED', async () => {
    const scanTimeMs = eventEndTimeMs + 25 * 60 * 60 * 1000;
    
    const res = await runSync(studentBId, scanTimeMs);
    assert.strictEqual(res.processed, 0);
    assert.strictEqual(res.errors[0].error_code, 'EVENT_LOCKED');
  });

  // Note: Test 4 (Valid On-Time Sync) would require a sync time BEFORE event_end + 24h.
  // We can't change the DB time to the past easily for the sync time in this test, 
  // but Test 1 proves the primary boundary logic works.

});
