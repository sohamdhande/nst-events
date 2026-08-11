// @ts-nocheck
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';

process.env.EXPO_ACCESS_TOKEN = "dummy_expo_access_token";

import { prisma } from '@nst/database';
import { adminPrisma } from './helpers/adminDb';
import { Expo } from 'expo-server-sdk';

// MUST set worker URL before importing worker!
process.env.WORKER_DATABASE_URL = 'postgresql://nst_worker:worker_password@localhost:5440/nst_events?schema=public';
import { processBatch } from '../../worker/src/worker';
import { expo } from '../../worker/src/index';

// No need to reset DATABASE_URL because we used WORKER_DATABASE_URL
import { submitForApproval, approveEvent, rejectEvent } from '../src/modules/events/events.service';
import { updateMemberRole } from '../src/modules/clubs/clubs.service';
import { attendanceService } from '../src/modules/attendance/attendance.service';
import * as assert from 'assert';

const generateId = () => crypto.randomUUID();

let testUserId: string;
let testAdminId: string;
let testClubId: string;
let testEventId = '';
let testSessionId = '';
let testDisputeId = '';

async function setupTestData() {
  console.log('🔄 Setting up test data...');
  
  const user = await adminPrisma.user.create({
    data: {
      email: `testuser-${Date.now()}@example.com`,
      fullName: 'Test User',
      googleSub: `sub-${Date.now()}`,
      globalRole: 'STUDENT',
      pushTokens: { create: { expoToken: 'ExponentPushToken[test-123]', deviceId: `test-device-${Date.now()}`, platform: 'IOS' } },
      notificationPreferences: {
        create: {
          pushEnabled: true,
          clubAnnouncements: true,
          eventReminders: true,
          attendanceAlerts: true,
        }
      }
    }
  });
  testUserId = user.id;

  const admin = await adminPrisma.user.create({
    data: {
      email: `admin-${Date.now()}@example.com`,
      fullName: 'Admin User',
      googleSub: `sub-admin-${Date.now()}`,
      globalRole: 'PLATFORM_ADMIN',
      pushTokens: { create: { expoToken: 'ExponentPushToken[admin-123]', deviceId: `admin-device-${Date.now()}`, platform: 'IOS' } },
      notificationPreferences: {
        create: {
          pushEnabled: true,
          clubAnnouncements: true,
          eventReminders: true,
          attendanceAlerts: true,
        }
      }
    }
  });
  testAdminId = admin.id;

  const club = await adminPrisma.club.create({
    data: {
      name: `Test E2E Club ${Date.now()}`,
      status: 'ACTIVE',
      memberships: {
        create: [
          { userId: testUserId, role: 'CLUB_ADMIN' },
          { userId: admin.id, role: 'FACULTY_MENTOR' }
        ]
      }
    }
  });
  testClubId = club.id;

  const event = await adminPrisma.event.create({
    data: {
      title: `Test E2E Event ${Date.now()}`,
      startTime: new Date(Date.now() + 86400000),
      endTime: new Date(Date.now() + 90000000),
      locationName: 'Test Location',
      eventType: 'OTHER',
      visibility: 'PUBLIC',
      createdBy: testUserId,
      eventClubs: { create: { clubId: testClubId, isPrimary: true } }
    }
  });
  testEventId = event.id;

  const session = await adminPrisma.attendanceSession.create({
    data: {
      eventId: testEventId,
      title: 'Session 1',
      startTime: new Date(Date.now() + 86400000),
      endTime: new Date(Date.now() + 86400000 + 3600000),
      openAt: new Date(),
      closeAt: new Date(Date.now() + 86400000 + 3600000),
      qrSecret: 'dummy_qr_secret_e2e'
    }
  });
  testSessionId = session.id;

  const dispute = await adminPrisma.attendanceDispute.create({
    data: {
      eventId: testEventId,
      sessionId: testSessionId,
      userId: testUserId,
      reason: 'Was there but phone died',
      status: 'PENDING',
      disputeWindowExpiresAt: new Date(Date.now() + 86400000),
    }
  });
  testDisputeId = dispute.id;
}

async function runTests() {
  await setupTestData();
  let passed = 0, failed = 0;

  const runTest = async (name: string, fn: () => Promise<void>) => {
    try {
      console.log(`\n▶️ RUNNING: ${name}`);
      await fn();
      console.log(`✅ PASSED: ${name}`);
      passed++;
    } catch (e: any) {
      console.error(`❌ FAILED: ${name}`);
      console.error(e.message || e);
      failed++;
    }
  };

  // Mock Expo Send
  let mockSendError: any = null;
  let mockReceipts: any = null;

  Expo.prototype.sendPushNotificationsAsync = async (chunks: any[]) => {
    if (mockSendError) throw mockSendError;
    return chunks.flat().map((msg: any) => ({
      status: 'ok',
      id: `ticket-${Date.now()}`
    }));
  };

  Expo.prototype.getPushNotificationReceiptsAsync = async (ticketIds: any[]) => {
    if (mockReceipts) return mockReceipts;
    const res: any = {};
    ticketIds.forEach((id: string) => {
      res[id] = { status: 'ok' };
    });
    return res;
  };

  await runTest('Happy Path: APPROVAL_REQUEST (Producer -> Queue -> Processing -> Waiting -> Completed)', async () => {
    await adminPrisma.event.update({ where: { id: testEventId }, data: { state: 'DRAFT' } });
    await submitForApproval(testUserId, testEventId);

    // APPROVAL_REQUEST is sent to faculty mentors and platform admins, not the submitter
    const allJobs = await adminPrisma.notificationJob.findMany({ where: { status: 'PENDING' } });
    const job = allJobs.find(j => (j.payload as any).notification_type === 'APPROVAL_REQUEST' && (j.payload as any).user_id === testAdminId);
    assert.ok(job, 'Job created in queue');

    await processBatch();

    let updatedJob = await adminPrisma.notificationJob.findUnique({ where: { id: job.id } });
    assert.strictEqual(updatedJob!.status, 'WAITING_FOR_RECEIPTS');
    assert.ok(updatedJob!.ticketIds, 'ticket_ids populated');

    await adminPrisma.$executeRaw`UPDATE notification_jobs SET available_at = now() WHERE id = ${job.id}::uuid`;
    
    await processBatch(); // Receipt Polling

    updatedJob = await adminPrisma.notificationJob.findUnique({ where: { id: job.id } });
    assert.strictEqual(updatedJob!.status, 'COMPLETED');
    assert.ok(!updatedJob!.ticketIds, 'ticket_ids cleared');

    const notification = await adminPrisma.notification.findFirst({ where: { type: 'APPROVAL_REQUEST', userId: testAdminId } });
    assert.ok(notification!.deliveredAt, 'delivered_at populated');
  });

  await runTest('Retry Verification: Transient Rate Limit 429', async () => {
    await adminPrisma.event.update({ where: { id: testEventId }, data: { state: 'PENDING_APPROVAL' } });
    mockSendError = { code: 'HTTP_429', message: 'Too many requests' };
    
    await approveEvent(testAdminId, testEventId);
    
    const allJobs = await adminPrisma.notificationJob.findMany({ where: { status: 'PENDING' }, orderBy: { createdAt: 'desc' } });
    let job = allJobs.find(j => (j.payload as any).notification_type === 'EVENT_APPROVED' && (j.payload as any).user_id === testUserId);
    await processBatch();

    let updatedJob = await adminPrisma.notificationJob.findUnique({ where: { id: job!.id } });
    assert.strictEqual(updatedJob!.status, 'RETRY_PENDING');
    assert.strictEqual(updatedJob!.attemptCount, 1);
    
    mockSendError = null; // Clear error for next tests
  });

  await runTest('Permanent Failure Verification', async () => {
    await adminPrisma.event.update({ where: { id: testEventId }, data: { state: 'PENDING_APPROVAL' } });
    // We'll mock the Expo send ticket returning DeviceNotRegistered
    Expo.prototype.sendPushNotificationsAsync = async (chunks: any[]) => {
      return chunks.flat().map((msg: any) => ({
        status: 'error',
        message: 'Device not registered',
        details: { error: 'DeviceNotRegistered' }
      }));
    };

    await rejectEvent(testAdminId, testEventId, 'Missing flyer');
    const allJobs = await adminPrisma.notificationJob.findMany({ where: { status: 'PENDING' }, orderBy: { createdAt: 'desc' } });
    let job = allJobs.find(j => (j.payload as any).notification_type === 'EVENT_REJECTED' && (j.payload as any).user_id === testUserId);
    await processBatch();

    let updatedJob = await adminPrisma.notificationJob.findUnique({ where: { id: job!.id } });
    assert.strictEqual(updatedJob!.status, 'FAILED');
    
    Expo.prototype.sendPushNotificationsAsync = async (chunks: any[]) => {
      return chunks.flat().map((msg: any) => ({ status: 'ok', id: `ticket-${Date.now()}` }));
    };
  });

  await runTest('Preference Verification', async () => {
    // Disable attendance_alerts
    await adminPrisma.notificationPreference.update({
      where: { userId: testUserId },
      data: { attendanceAlerts: false }
    });

    await attendanceService.resolveAttendanceDispute(testUserId, testDisputeId, { resolution: 'APPROVED' });

    // Should create a Notification row but NO Queue job
    const notif = await adminPrisma.notification.findFirst({ where: { type: 'ATTENDANCE_DISPUTE_RESOLVED', userId: testUserId } });
    assert.ok(notif, 'Notification created in DB');

    const jobs = await adminPrisma.notificationJob.findMany();
    const job = jobs.find(j => (j.payload as any).notification_type === 'ATTENDANCE_DISPUTE_RESOLVED' && (j.payload as any).user_id === testUserId);
    assert.ok(!job, 'No job queued due to preference gate');

    // Re-enable
    await adminPrisma.notificationPreference.update({
      where: { userId: testUserId },
      data: { attendanceAlerts: true }
    });
  });

  await runTest('Idempotency Verification', async () => {
    await adminPrisma.notificationJob.deleteMany();
    // Call ROLE_CHANGED twice
    await updateMemberRole(testUserId, testClubId, testUserId, 'CLUB_ADMIN');
    await updateMemberRole(testUserId, testClubId, testUserId, 'CLUB_ADMIN');

    const allJobs = await adminPrisma.notificationJob.findMany();
    const jobs = allJobs.filter(j => (j.payload as any).notification_type === 'ROLE_CHANGED' && (j.payload as any).user_id === testUserId);
    assert.strictEqual(jobs.length, 1, 'Only one job should be created due to idempotency');
  });

  console.log(`\n========================================`);
  console.log(`TEST RUN COMPLETE: ${passed} Passed, ${failed} Failed`);
  console.log(`========================================\n`);

  // 🧹 Cleanup
  await adminPrisma.eventRegistration.deleteMany({ where: { eventId: testEventId } });
  await adminPrisma.attendanceRecord.deleteMany({ where: { eventId: testEventId } });
  await adminPrisma.event.delete({ where: { id: testEventId } });
  await adminPrisma.clubMembership.deleteMany({ where: { clubId: testClubId } });
  await adminPrisma.club.delete({ where: { id: testClubId } });
  await adminPrisma.notificationJob.deleteMany({ where: { payload: { path: ['user_id'], equals: testUserId } } });
  await adminPrisma.notificationJob.deleteMany({ where: { payload: { path: ['user_id'], equals: testAdminId } } });
  await adminPrisma.notification.deleteMany({ where: { userId: { in: [testUserId, testAdminId] } } });
  await adminPrisma.pushToken.deleteMany({ where: { userId: { in: [testUserId, testAdminId] } } });
  await adminPrisma.user.delete({ where: { id: testUserId } });
  await adminPrisma.user.delete({ where: { id: testAdminId } });

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(console.error);
