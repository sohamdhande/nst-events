import test from 'node:test';
import * as assert from 'node:assert';
import { mapDatabaseError } from '../../src/lib/errors/database-error-mapper';
import { UnprocessableEntityError, ConflictError, BadRequestError, ForbiddenError } from '../../src/lib/errors';
import { logger } from '../../src/lib/logger';

// We won't use vitest mocks, we'll just test the mapping logic directly.
// The logger is used internally, we don't strictly need to mock it unless we want to assert on it.

test('ERROR-03 Message Independence Tests', async (t) => {

  await t.test('New Error-03 Bindings', async (t2) => {
    
    await t2.test('maps U0033 to UnprocessableEntityError (EVENT_NOT_PUBLISHED) regardless of message', () => {
      const err = { code: 'P2010', meta: { code: 'U0033' }, message: 'This message can be anything' };
      assert.throws(() => mapDatabaseError(err), UnprocessableEntityError);
      try { mapDatabaseError(err); } catch (e: any) {
        assert.strictEqual(e.message, 'EVENT_NOT_PUBLISHED');
        assert.strictEqual(e.statusCode, 422);
      }
    });

    await t2.test('maps U0040 to BadRequestError (LEADER_CANNOT_LEAVE)', () => {
      const err = { code: 'P2010', meta: { code: 'U0040' }, message: 'Leader cannot leave' };
      assert.throws(() => mapDatabaseError(err), BadRequestError);
      try { mapDatabaseError(err); } catch (e: any) {
        assert.strictEqual(e.message, 'LEADER_CANNOT_LEAVE');
        assert.strictEqual(e.statusCode, 400);
      }
    });

    await t2.test('maps U0041 to BadRequestError (NEW_LEADER_NOT_ACTIVE)', () => {
      const err = { code: 'P2010', meta: { code: 'U0041' }, message: 'New leader not active' };
      assert.throws(() => mapDatabaseError(err), BadRequestError);
      try { mapDatabaseError(err); } catch (e: any) {
        assert.strictEqual(e.message, 'NEW_LEADER_NOT_ACTIVE');
        assert.strictEqual(e.statusCode, 400);
      }
    });

    await t2.test('maps U0045 to ConflictError (RACE_CONDITION_STATE)', () => {
      const err = { code: 'P2010', meta: { code: 'U0045' }, message: 'Race condition' };
      assert.throws(() => mapDatabaseError(err), ConflictError);
      try { mapDatabaseError(err); } catch (e: any) {
        assert.strictEqual(e.message, 'RACE_CONDITION_STATE');
        assert.strictEqual(e.statusCode, 409);
      }
    });

    await t2.test('maps U0048 to UnprocessableEntityError (DISPUTE_WINDOW_EXPIRED)', () => {
      const err = { code: 'P2010', meta: { code: 'U0048' }, message: 'Dispute window expired' };
      assert.throws(() => mapDatabaseError(err), UnprocessableEntityError);
      try { mapDatabaseError(err); } catch (e: any) {
        assert.strictEqual(e.message, 'DISPUTE_WINDOW_EXPIRED');
        assert.strictEqual(e.statusCode, 422);
      }
    });

    await t2.test('maps U0049 to UnprocessableEntityError (SESSION_CLOSED)', () => {
      const err = { code: 'P2010', meta: { code: 'U0049' }, message: 'Session closed' };
      assert.throws(() => mapDatabaseError(err), UnprocessableEntityError);
      try { mapDatabaseError(err); } catch (e: any) {
        assert.strictEqual(e.message, 'SESSION_CLOSED');
        assert.strictEqual(e.statusCode, 422);
      }
    });
  });

  await t.test('PostgreSQL Standard Code Mapping', async (t2) => {
    
    await t2.test('maps 42501 safely to ForbiddenError regardless of text structure', () => {
      const err = { code: 'P2010', meta: { code: '42501' }, message: 'permission denied for relation xyz' };
      assert.throws(() => mapDatabaseError(err), ForbiddenError);
      try { mapDatabaseError(err); } catch (e: any) {
        assert.strictEqual(e.message, 'Access denied by Row-Level Security');
        assert.strictEqual(e.statusCode, 403);
      }
    });

    await t2.test('maps 23505 safely to ConflictError regardless of text structure', () => {
      const err = { code: 'P2010', meta: { code: '23505' }, message: 'duplicate key value violates unique constraint' };
      assert.throws(() => mapDatabaseError(err), ConflictError);
      try { mapDatabaseError(err); } catch (e: any) {
        assert.strictEqual(e.message, 'A resource with this identifier already exists');
        assert.strictEqual(e.statusCode, 409);
      }
    });
  });
});
