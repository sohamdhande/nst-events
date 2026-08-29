import { describe, it, before, after } from 'node:test';
import * as assert from 'node:assert';
import { Prisma } from '@prisma/client';
import { mapDatabaseError } from '../../src/lib/errors/database-error-mapper';
import { sanitizeOfflineError } from '../../src/modules/attendance/attendance-error-mapper';
import { UnprocessableEntityError } from '../../src/lib/errors';
import { AttendanceService } from '../../src/modules/attendance/attendance.service';
import { adminPrisma } from '../helpers/adminDb';

describe('ERROR-01B/C: Attendance Error Contract', () => {
  const service = new AttendanceService();

  const createPrismaError = (sqlstate: string, message: string) => {
    return new Prisma.PrismaClientKnownRequestError(
      message,
      {
        code: 'P2010',
        clientVersion: '5.x',
        meta: { code: sqlstate, message }
      }
    );
  };

  describe('Direct RPC Error Mapping (mapDatabaseError)', () => {
    const codes = [
      { code: 'U0001', semantic: 'UNAUTHORIZED' },
      { code: 'U0002', semantic: 'WAITLISTED' },
      { code: 'U0003', semantic: 'NOT_REGISTERED' },
      { code: 'U0004', semantic: 'REGISTRATION_NOT_ELIGIBLE' },
      { code: 'U0005', semantic: 'SESSION_CLOSED' },
      { code: 'U0006', semantic: 'EVENT_LOCKED' },
      { code: 'U0007', semantic: 'OUTSIDE_GEOFENCE' },
      { code: 'U0008', semantic: 'MOCK_LOCATION_REJECTED' },
      { code: 'U0009', semantic: 'LOCATION_UNAVAILABLE' },
      { code: 'U0010', semantic: 'INVALID_LOCATION' },
      { code: 'U0011', semantic: 'LOCATION_UNRELIABLE' },
      { code: 'U0012', semantic: 'ACADEMIC_PROFILE_MISSING' },
      { code: 'U0013', semantic: 'ACADEMICALLY_INELIGIBLE' },
      { code: 'U0014', semantic: 'SIGNATURE_ALREADY_CONSUMED' },
    ];

    for (const mapping of codes) {
      it(`maps ${mapping.code} to ${mapping.semantic}`, () => {
        const err = createPrismaError(mapping.code, 'Original DB Message');
        try {
          mapDatabaseError(err);
          assert.fail('Should have thrown');
        } catch (e: any) {
          assert.ok(e instanceof UnprocessableEntityError);
          assert.strictEqual(e.message, mapping.semantic);
          assert.strictEqual(e.statusCode, 422);
          // Verify no SQLERRM or SQLSTATE leakage
          assert.strictEqual(e.sqlstate, undefined);
          assert.strictEqual(e.db_message, undefined);
          assert.ok(!e.message.includes('Original DB Message'));
        }
      });
    }

    it('Message Independence: identical semantic API behavior regardless of message text', () => {
      const err1 = createPrismaError('U0013', 'Lock down initiated');
      const err2 = createPrismaError('U0013', 'Completely different');

      let caught1: any, caught2: any;
      try { mapDatabaseError(err1); } catch (e) { caught1 = e; }
      try { mapDatabaseError(err2); } catch (e) { caught2 = e; }

      assert.strictEqual(caught1.message, caught2.message);
      assert.strictEqual(caught1.message, 'ACADEMICALLY_INELIGIBLE');
    });

    it('Unknown direct DB error: XX000 -> 500, no leakage', () => {
      const err = createPrismaError('XX000', 'SECRET DATABASE FAILURE DETAILS');
      try {
        mapDatabaseError(err);
        assert.fail('Should have thrown');
      } catch (e: any) {
        assert.strictEqual(e.message, 'An unexpected error occurred');
        assert.notStrictEqual(e.statusCode, 422);
        assert.strictEqual(e.sqlstate, undefined);
        assert.ok(!e.message.includes('SECRET DATABASE'));
        assert.ok(!e.message.includes('XX000'));
      }
    });
  });

  describe('Offline Sync Error Mapping (sanitizeOfflineError)', () => {
    it('Known offline SQLSTATE', () => {
      const result = sanitizeOfflineError({ user_id: 'user1', error_code: 'U0002' });
      assert.deepStrictEqual(result, {
        user_id: 'user1',
        error_code: 'WAITLISTED'
      });
    });

    it('Unknown offline SQLSTATE: XX000 -> ATTENDANCE_ERROR, no leakage', () => {
      const result = sanitizeOfflineError({ user_id: 'user2', error_code: 'XX000' });
      assert.deepStrictEqual(result, {
        user_id: 'user2',
        error_code: 'ATTENDANCE_ERROR'
      });
    });
    
    it('No SQLERRM leakage', () => {
       const result = sanitizeOfflineError({ user_id: 'user3', error_code: 'U0014' } as any);
       assert.strictEqual((result as any).message, undefined);
       assert.strictEqual((result as any).db_message, undefined);
    });
  });

  describe('Database Function Propagation', () => {
    let testUserId: string;
    let testEventId: string;
    let testSessionId: string;

    before(async () => {
      // Create a user and an event with a session
      const user = await adminPrisma.user.create({
        data: { id: crypto.randomUUID(), email: `test-${Date.now()}@example.com`, fullName: 'Test User', googleSub: `sub-${Date.now()}`, globalRole: 'PLATFORM_ADMIN' }
      });
      testUserId = user.id;

      const event = await adminPrisma.event.create({
        data: {
          title: 'Test Event',
          startTime: new Date(),
          endTime: new Date(Date.now() + 100000),
          visibility: 'PUBLIC',
          state: 'PUBLISHED',
          createdBy: testUserId,
          audience: 'SPECIFIC_BATCHES', // requires academic profile which test user lacks -> U0012
          registrationType: 'INDIVIDUAL', // registration required, but academic profile is missing
          eventType: 'WORKSHOP'
        }
      });
      testEventId = event.id;

      const session = await adminPrisma.attendanceSession.create({
        data: {
          eventId: testEventId,
          title: 'Test Session',
          startTime: new Date(),
          endTime: new Date(Date.now() + 100000),
          openAt: new Date(Date.now() - 100000),
          closeAt: new Date(Date.now() + 100000),
          createdBy: testUserId,
          qrSecret: 'secret',
        }
      });
      testSessionId = session.id;
    });

    after(async () => {
      if (testSessionId) await adminPrisma.attendanceSession.deleteMany({ where: { id: testSessionId } });
      if (testEventId) await adminPrisma.event.deleteMany({ where: { id: testEventId } });
      if (testUserId) await adminPrisma.user.deleteMany({ where: { id: testUserId } });
    });

    it('Nested eligibility propagation: manualMarkAttendance preserves SQLSTATE from check_attendance_eligibility', async () => {
      try {
        await adminPrisma.$transaction([
          adminPrisma.$executeRaw`SELECT set_config('app.user_id', ${testUserId}::text, true)`,
          adminPrisma.$queryRaw`SELECT * FROM manual_mark_attendance(${testSessionId}::uuid, ${testUserId}::uuid)`
        ]);
        assert.fail('Should have failed');
      } catch (error: any) {
        assert.strictEqual(error.meta?.code, 'U0003');
      }
    });
  });
});
