import { test, expect, vi, beforeEach } from 'vitest';
import { apiClient } from '../lib/api';

beforeEach(() => {
  vi.unstubAllGlobals();
});

test('Web Dashboard: Fetch successful summary', async () => {
  const mockResponse = {
    upcoming_events: [{ id: '1', title: 'Event 1', start_time: '2026-08-14T10:00:00Z' }],
    pending_approvals: [{ id: '2', title: 'Approval 1' }],
    my_clubs: [{ id: '3', name: 'Club 1', member_count: 10 }]
  };

  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    text: async () => JSON.stringify(mockResponse),
    headers: new Headers(),
  });
  vi.stubGlobal('fetch', fetchMock);

  const result = await apiClient('/v1/dashboard/summary');
  expect(result).toEqual(mockResponse);
});

test('Web Dashboard: API Error', async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: false,
    status: 500,
    json: async () => ({ message: 'Internal Server Error' }),
    headers: new Headers(),
  });
  vi.stubGlobal('fetch', fetchMock);

  await expect(apiClient('/v1/dashboard/summary')).rejects.toThrow('Internal Server Error');
});

test('Web Dashboard: Empty summary', async () => {
  const mockResponse = {
    upcoming_events: [],
    pending_approvals: [],
    my_clubs: []
  };

  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    text: async () => JSON.stringify(mockResponse),
    headers: new Headers(),
  });
  vi.stubGlobal('fetch', fetchMock);

  const result = await apiClient('/v1/dashboard/summary');
  expect(result).toEqual(mockResponse);
});
