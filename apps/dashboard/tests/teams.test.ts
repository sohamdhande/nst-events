import { test, expect, vi, beforeEach } from 'vitest';
import { apiClient } from '../lib/api';

beforeEach(() => {
  vi.unstubAllGlobals();
});

test('Web Teams: Fetch successful list', async () => {
  const mockResponse = {
    data: [
      {
        id: 'team-1',
        name: 'Alpha Team',
        leader_id: 'user-1',
        leader_name: 'John Doe',
        member_count: 2,
        members: [
          { user_id: 'user-1', full_name: 'John Doe', registration_status: 'REGISTERED' },
          { user_id: 'user-2', full_name: 'Jane Smith', registration_status: 'REGISTERED' }
        ]
      }
    ],
    pagination: { nextCursor: undefined }
  };

  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    text: async () => JSON.stringify(mockResponse),
    headers: new Headers(),
  });
  vi.stubGlobal('fetch', fetchMock);

  const result = await apiClient('/v1/events/evt-1/teams');
  expect(result).toEqual(mockResponse);
});

test('Web Teams: Join team success (201)', async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    status: 201,
    text: async () => '',
    headers: new Headers(),
  });
  vi.stubGlobal('fetch', fetchMock);

  const result = await apiClient('/v1/teams/team-1/join', { method: 'POST' });
  expect(result).toEqual({});
});

test('Web Teams: Leave team success (204)', async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    status: 204,
    text: async () => '',
    headers: new Headers(),
  });
  vi.stubGlobal('fetch', fetchMock);

  const result = await apiClient('/v1/teams/team-1/leave', { method: 'DELETE' });
  expect(result).toEqual({});
});

test('Web Teams: Unauthorized Error (401)', async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: false,
    status: 401,
    json: async () => ({ message: 'Unauthorized' }),
    headers: new Headers(),
  });
  vi.stubGlobal('fetch', fetchMock);

  await expect(apiClient('/v1/teams/team-1/join', { method: 'POST' })).rejects.toThrow('Unauthorized');
});
