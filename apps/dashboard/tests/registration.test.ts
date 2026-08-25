import { test, expect, vi, beforeEach } from 'vitest';
import { apiClient } from '../lib/api';

beforeEach(() => {
  vi.unstubAllGlobals();
});

test('Web Registration: Successful Registration returns empty response (201)', async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    status: 201,
    text: async () => '',
    headers: new Headers(),
  });
  vi.stubGlobal('fetch', fetchMock);

  const result = await apiClient('/v1/events/evt-1/register', { method: 'POST' });
  expect(result).toEqual({});
});

test('Web Registration: Conflict Error (409) throws proper API Error', async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: false,
    status: 409,
    json: async () => ({ message: 'Event is at full capacity.' }),
    headers: new Headers(),
  });
  vi.stubGlobal('fetch', fetchMock);

  await expect(apiClient('/v1/events/evt-1/register', { method: 'POST' })).rejects.toThrow('Event is at full capacity.');
});

test('Web Registration: Unauthorized Error (401)', async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: false,
    status: 401,
    json: async () => ({ message: 'Unauthorized' }),
    headers: new Headers(),
  });
  vi.stubGlobal('fetch', fetchMock);

  await expect(apiClient('/v1/events/evt-1/register', { method: 'POST' })).rejects.toThrow('Unauthorized');
});
