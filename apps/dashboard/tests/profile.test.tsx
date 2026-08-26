// @vitest-environment jsdom
import { test, expect, vi, beforeEach } from 'vitest';
import { apiClient } from '../lib/api';
import { render, screen, cleanup } from '@testing-library/react';
import React from 'react';
import { getWebAuthStore } from '../lib/auth-store';
import '@testing-library/jest-dom/vitest';
import ProfilePage from '../app/(app)/profile/page';
import { useCurrentUser } from '../hooks/useCurrentUser';

vi.mock('../hooks/useCurrentUser', () => ({
  useCurrentUser: vi.fn(),
}));

vi.mock('../hooks/useLogout', () => ({
  useLogout: () => ({ mutate: vi.fn(), isPending: false }),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

import { afterEach } from 'vitest';
afterEach(() => {
  cleanup();
});

test('Web Profile: Fetch current user profile', async () => {
  const mockUser = {
    id: 'user-1',
    email: 'student@example.com',
    full_name: 'John Student',
    avatar_url: null,
    global_role: 'STUDENT',
    club_memberships: []
  };

  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    text: async () => JSON.stringify(mockUser),
    headers: new Headers(),
  });
  vi.stubGlobal('fetch', fetchMock);

  const result = await apiClient('/users/me');
  expect(result).toEqual(mockUser);
});

test('Web Profile: Logout triggers backend and clears store', async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ success: true }),
    headers: new Headers(),
  });
  vi.stubGlobal('fetch', fetchMock);

  // Set initial token
  getWebAuthStore().setAccessToken('test-token');
  expect(getWebAuthStore().accessToken).toBe('test-token');

  // Backend call
  await apiClient('/auth/logout', { method: 'POST' });
  
  // Clear store
  getWebAuthStore().logout();
  expect(getWebAuthStore().accessToken).toBeNull();
});

test('Web Profile: Displays Academic Program and Batch when available', () => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });

  (useCurrentUser as any).mockReturnValue({
    data: {
      id: 'user-1',
      email: 'student@adypu.edu.in',
      full_name: 'Test Student',
      global_role: 'STUDENT',
      club_memberships: [],
      academic_profile: {
        batch: {
          program: { name: 'B.Tech CSE AI/ML' },
          admission_year: 2025,
          graduation_year: 2029
        },
        assignment_source: 'INSTITUTIONAL_EMAIL_INFERENCE'
      }
    },
    isLoading: false,
    isError: false,
  });

  render(<ProfilePage />);

  expect(screen.getByText('B.Tech CSE AI/ML')).toBeInTheDocument();
  expect(screen.getByText('2025–2029')).toBeInTheDocument();
});

test('Web Profile: Does not crash if academic_profile is missing', () => {
  (useCurrentUser as any).mockReturnValue({
    data: {
      id: 'user-1',
      email: 'student@adypu.edu.in',
      full_name: 'Test Student',
      global_role: 'STUDENT',
      club_memberships: [],
      academic_profile: null
    },
    isLoading: false,
    isError: false,
  });

  render(<ProfilePage />);

  expect(screen.queryByText('Academic Program')).not.toBeInTheDocument();
});
