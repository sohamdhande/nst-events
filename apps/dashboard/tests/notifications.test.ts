import { test, expect, vi, beforeEach } from 'vitest';
import { apiClient } from '../lib/api';

beforeEach(() => {
  vi.unstubAllGlobals();
});

test('Web Notifications: Fetch successful list', async () => {
  const mockResponse = {
    data: [
      {
        id: 'notif-1',
        title: 'Event Update',
        body: 'The time has changed',
        type: 'EVENT_UPDATE',
        metadata: { eventId: 'evt-1' },
        readAt: null,
        createdAt: '2026-08-14T10:00:00Z',
      }
    ],
    pagination: { has_more: false }
  };

  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    text: async () => JSON.stringify(mockResponse),
    headers: new Headers(),
  });
  vi.stubGlobal('fetch', fetchMock);

  const result = await apiClient('/v1/notifications?limit=20');
  expect(result).toEqual(mockResponse);
});

test('Web Notifications: Mark as read success', async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ success: true }),
    headers: new Headers(),
  });
  vi.stubGlobal('fetch', fetchMock);

  const result = await apiClient('/v1/notifications/notif-1/read', { method: 'PATCH' });
  expect(result).toEqual({ success: true });
});

test('Web Notifications: Unauthorized Error (401)', async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: false,
    status: 401,
    json: async () => ({ message: 'Unauthorized' }),
    headers: new Headers(),
  });
  vi.stubGlobal('fetch', fetchMock);

  await expect(apiClient('/v1/notifications/notif-1/read', { method: 'PATCH' })).rejects.toThrow('Unauthorized');
});
