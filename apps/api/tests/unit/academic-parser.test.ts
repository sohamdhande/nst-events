import test from 'node:test';
import assert from 'node:assert/strict';
import { parseAdypuEmail } from '../../src/modules/auth/academic-parser';

test('Academic Parser Strictness', async (t) => {
  await t.test('parses valid e25 format', () => {
    const result = parseAdypuEmail('e25b070564@adypu.edu.in');
    assert.deepEqual(result, {
      prefix: 'e',
      admissionYear: 2025,
    });
  });

  await t.test('parses valid uppercase format (normalized)', () => {
    const result = parseAdypuEmail('E25B070564@ADYPU.EDU.IN');
    assert.deepEqual(result, {
      prefix: 'e',
      admissionYear: 2025,
    });
  });

  await t.test('parses valid format with different prefix', () => {
    const result = parseAdypuEmail('m24a123@adypu.edu.in');
    assert.deepEqual(result, {
      prefix: 'm',
      admissionYear: 2024,
    });
  });

  await t.test('rejects ambiguous missing prefix', () => {
    const result = parseAdypuEmail('25b070564@adypu.edu.in');
    assert.equal(result, null);
  });

  await t.test('rejects arbitrary generic prefix xyz', () => {
    const result = parseAdypuEmail('xyz25b070564@adypu.edu.in');
    assert.equal(result, null);
  });
});
