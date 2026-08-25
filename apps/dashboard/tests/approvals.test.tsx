import { test, expect, vi, beforeEach } from 'vitest';
import { apiClient } from '../lib/api';
import { getWebAuthStore } from '../lib/auth-store';
import { queryClient } from '../lib/query-client';

beforeEach(() => {
  vi.unstubAllGlobals();
  getWebAuthStore().logout();
  queryClient.clear();
});

test('Web Approvals: Fetch successful approvals for FACULTY_MENTOR', async () => {
  const mockResponse = {
    data: [
      {
        id: 'event-1',
        title: 'Pending Tech Meetup',
        startTime: '2026-09-01T10:00:00Z',
        endTime: '2026-09-01T12:00:00Z',
        eventClubs: [{ club: { name: 'Tech Club' } }],
        state: 'PENDING_APPROVAL'
      }
    ],
    pagination: {
      has_more: false
    }
  };

  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    text: async () => JSON.stringify(mockResponse),
    headers: new Headers(),
  });
  vi.stubGlobal('fetch', fetchMock);

  getWebAuthStore().setAccessToken('faculty-token');

  const result = await apiClient('/v1/events?filter_state=PENDING_APPROVAL');
  expect(result).toEqual(mockResponse);
  expect(result.data[0].state).toBe('PENDING_APPROVAL');
  expect(result.data[0].eventClubs[0].club.name).toBe('Tech Club');
});

test('Web Approvals: API Error correctly triggers rejection', async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: false,
    status: 403,
    json: async () => ({ message: 'Forbidden' }),
    headers: new Headers(),
  });
  vi.stubGlobal('fetch', fetchMock);

  getWebAuthStore().setAccessToken('student-token');

  await expect(apiClient('/v1/events?filter_state=PENDING_APPROVAL')).rejects.toThrow('Forbidden');
});

test('Web Approvals: Empty approvals queue state', async () => {
  const mockResponse = {
    data: [],
    pagination: { has_more: false }
  };

  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    text: async () => JSON.stringify(mockResponse),
    headers: new Headers(),
  });
  vi.stubGlobal('fetch', fetchMock);

  const result = await apiClient('/v1/events?filter_state=PENDING_APPROVAL');
  expect(result.data).toHaveLength(0);
});

test('Web Approvals: Successful Approve mutation', async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ success: true }),
    headers: new Headers(),
  });
  vi.stubGlobal('fetch', fetchMock);

  const result = await apiClient('/v1/events/event-1/approve', { method: 'POST' });
  expect(result).toEqual({ success: true });
  expect(fetchMock).toHaveBeenCalledWith(
    expect.stringContaining('/v1/events/event-1/approve'),
    expect.objectContaining({ method: 'POST' })
  );
});

test('Web Approvals: Successful Reject mutation', async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ success: true }),
    headers: new Headers(),
  });
  vi.stubGlobal('fetch', fetchMock);

  const rejectionBody = { rejection_reason: 'Does not align with university guidelines.' };
  const result = await apiClient('/v1/events/event-2/reject', { 
    method: 'POST',
    body: JSON.stringify(rejectionBody)
  });
  
  expect(result).toEqual({ success: true });
  expect(fetchMock).toHaveBeenCalledWith(
    expect.stringContaining('/v1/events/event-2/reject'),
    expect.objectContaining({
      method: 'POST',
      body: JSON.stringify(rejectionBody)
    })
  );
});

test('Web Approvals: Optimistic Cache Invalidation simulation', () => {
  queryClient.setQueryData(['events', 'pending'], {
    data: [{ id: 'event-1' }, { id: 'event-2' }]
  });
  
  // Simulate optimistic update from mutation
  queryClient.setQueryData<{data: any[]}>(['events', 'pending'], (oldData) => {
    if (!oldData) return oldData;
    return {
      ...oldData,
      data: oldData.data.filter((evt) => evt.id !== 'event-1')
    };
  });
  
  const updatedData = queryClient.getQueryData<{data: any[]}>(['events', 'pending']);
  expect(updatedData?.data).toHaveLength(1);
  expect(updatedData?.data[0].id).toBe('event-2');
});
