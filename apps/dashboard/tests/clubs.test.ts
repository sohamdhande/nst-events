import { test, expect, vi, beforeEach } from 'vitest';
import { apiClient } from '../lib/api';

beforeEach(() => {
  vi.unstubAllGlobals();
});

test('Web Clubs: Fetch successful list', async () => {
  const mockResponse = {
    data: [
      {
        id: 'club-1',
        name: 'Tech Club',
        description: 'The best club',
        status: 'ACTIVE',
        banner_url: 'https://example.com/banner.png',
        event_count: 5,
        member_count: 120,
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

  const result = await apiClient('/clubs');
  expect(result).toEqual(mockResponse);
  
  // Verify member_count and event_count explicitly to ensure we are testing for the correct DTO
  expect(result.data[0].event_count).toBe(5);
  expect(result.data[0].member_count).toBe(120);
});

test('Web Clubs: API Error triggers rejection', async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: false,
    status: 500,
    json: async () => ({ message: 'Internal Server Error' }),
    headers: new Headers(),
  });
  vi.stubGlobal('fetch', fetchMock);

  await expect(apiClient('/clubs')).rejects.toThrow('Internal Server Error');
});

test('Web Clubs: Empty response', async () => {
  const mockResponse = {
    data: [],
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

  const result = await apiClient('/clubs');
  expect(result.data).toHaveLength(0);
});

test('Web Clubs: Search fetching', async () => {
  const mockResponse = {
    data: [
      {
        id: 'club-2',
        name: 'Science Club',
        description: 'A club for science',
        status: 'ACTIVE',
        banner_url: null,
        event_count: 2,
        member_count: 45,
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

  const result = await apiClient('/clubs/search?q=Science');
  expect(result.data[0].name).toBe('Science Club');
  expect(result.data[0].member_count).toBe(45);
});
