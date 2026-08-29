import test from 'node:test';
import * as assert from 'node:assert';
import { mapDatabaseError } from '../../src/lib/errors/database-error-mapper';
import { NotFoundError, UnprocessableEntityError, ConflictError } from '../../src/lib/errors';
import { logger } from '../../src/lib/logger';

test('ERROR-02 Message Independence Tests', async (t) => {

  await t.test('Registration and Team Errors', async (t2) => {
    await t2.test('maps U0032 to NotFoundError (EVENT_NOT_FOUND) regardless of message text', () => {
      const err = {
        code: 'P2010',
        meta: { code: 'U0032' },
        message: 'This message can be anything like "Event missing" or "Not found"'
      };
      assert.throws(() => mapDatabaseError(err), NotFoundError);
      try {
        mapDatabaseError(err);
      } catch (e: any) {
        assert.strictEqual(e.message, 'EVENT_NOT_FOUND');
        assert.strictEqual(e.statusCode, 404);
      }
    });

    await t2.test('maps U0034 to NotFoundError (TEAM_NOT_FOUND) independently of message', () => {
      const err = {
        code: 'P2010',
        meta: { code: 'U0034' },
        message: 'The team was not found in the db'
      };
      assert.throws(() => mapDatabaseError(err), NotFoundError);
      try {
        mapDatabaseError(err);
      } catch (e: any) {
        assert.strictEqual(e.message, 'TEAM_NOT_FOUND');
        assert.strictEqual(e.statusCode, 404);
      }
    });

    await t2.test('maps U0046 to ConflictError (RACE_CONDITION_LOCKED)', () => {
      const err = {
        code: 'P2010',
        meta: { code: 'U0046' },
        message: 'Race condition: Event is already locked'
      };
      assert.throws(() => mapDatabaseError(err), ConflictError);
      try {
        mapDatabaseError(err);
      } catch (e: any) {
        assert.strictEqual(e.message, 'RACE_CONDITION_LOCKED');
        assert.strictEqual(e.statusCode, 409);
      }
    });
  });

  await t.test('Unknown Error Sanitization', async (t2) => {
    await t2.test('sanitizes XX000 completely', () => {
      const err = {
        code: 'P2010',
        meta: { code: 'XX000' },
        message: 'SECRET INTERNAL DATABASE FAILURE'
      };
      
      assert.throws(() => mapDatabaseError(err), /An unexpected error occurred/);
    });

    await t2.test('sanitizes completely unknown structures gracefully', () => {
      const err = new Error('Some random node error');
      assert.throws(() => mapDatabaseError(err), /An unexpected error occurred/);
    });
  });
  
  await t.test('Prisma P-Code handling', async (t2) => {
    await t2.test('maps Prisma P2002 to ConflictError safely', () => {
      const err = {
        code: 'P2002',
        message: 'Unique constraint failed on the fields: (`email`)'
      };
      assert.throws(() => mapDatabaseError(err), ConflictError);
    });

    await t2.test('maps Prisma P2025 to NotFoundError safely', () => {
      const err = {
        code: 'P2025',
        message: 'Record to update not found.'
      };
      assert.throws(() => mapDatabaseError(err), NotFoundError);
    });
  });
});
