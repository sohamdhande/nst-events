import { describe, it } from 'node:test';
import assert from 'node:assert';
import { buildEventChannel } from '../../src/modules/sse/sse.utils';
import { UnprocessableEntityError } from '../../src/lib/errors';

describe('SSE Utils - buildEventChannel', () => {
  it('should construct channel for valid UUID', () => {
    const uuid = '123e4567-e89b-12d3-a456-426614174000';
    const channel = buildEventChannel(uuid);
    assert.strictEqual(channel, `event_${uuid}_live`);
  });

  it('should reject invalid UUIDs', () => {
    const invalidInputs = [
      'not-a-uuid',
      '123e4567-e89b-12d3-a456-426614174000;', // SQL injection attempt
      "123e4567-e89b-12d3-a456-426614174000'", // Quotes
      ' 123e4567-e89b-12d3-a456-426614174000 ', // Whitespace
      '123e4567e89b12d3a456426614174000', // Missing dashes
      '1_live; DROP TABLE users; --'
    ];

    for (const input of invalidInputs) {
      assert.throws(() => buildEventChannel(input), UnprocessableEntityError);
    }
  });
});
