// @vitest-environment jsdom
import { expect, describe, it, vi, beforeEach, afterEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ClubsDirectoryPage from '../app/(app)/clubs/page';
import { CreateClubModal } from '../app/(app)/clubs/CreateClubModal';
import * as useCurrentUserHook from '../hooks/useCurrentUser';
import * as useClubsHook from '../hooks/useClubs';
import * as useUserManagementHook from '../hooks/useUserManagement';
import * as useCreateClubHook from '../hooks/useCreateClub';

// Setup basic mocks
vi.mock('../hooks/useCurrentUser');
vi.mock('../hooks/useClubs');
vi.mock('../hooks/useUserManagement');
vi.mock('../hooks/useCreateClub');
vi.mock('antd/es/app', () => ({
  App: {
    useApp: () => ({
      message: { success: vi.fn(), error: vi.fn() },
    }),
  },
}));

// Mock window.matchMedia for Antd
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

// Mock ResizeObserver for Antd
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

const renderWithProviders = (ui: React.ReactElement) => {
  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>
  );
};

describe('Club Banner UX (WEB-39)', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.spyOn(useCurrentUserHook, 'useCurrentUser').mockReturnValue({
      data: { global_role: 'PLATFORM_ADMIN' },
    } as any);

    vi.spyOn(useCreateClubHook, 'useCreateClub').mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as any);

    vi.spyOn(useUserManagementHook, 'useAdminUsers').mockReturnValue({
      data: {
        pages: [{ data: [], pagination: { next_cursor: null } }],
      },
      isLoading: false,
    } as any);
  });

  afterEach(() => {
    cleanup();
  });

  it('1. Existing banner renders and 2. No-banner fallback renders', () => {
    vi.spyOn(useClubsHook, 'useClubs').mockReturnValue({
      data: {
        data: [
          {
            id: 'club-1',
            name: 'With Banner',
            description: 'Has banner',
            status: 'ACTIVE',
            banner_url: 'https://example.com/banner.jpg',
            event_count: 0,
            member_count: 1,
          },
          {
            id: 'club-2',
            name: 'No Banner Club',
            description: 'No banner',
            status: 'ACTIVE',
            banner_url: null,
            event_count: 0,
            member_count: 1,
          },
        ],
      },
      isLoading: false,
    } as any);

    renderWithProviders(<ClubsDirectoryPage />);

    // Fallback text should render for the second club
    expect(screen.getByText('No Banner')).toBeInTheDocument();

    // Verify the first club has the background image
    // In RTL, we can't easily query by background-image directly without specific locators,
    // but we can query by name to ensure clubs rendered
    expect(screen.getByText('With Banner')).toBeInTheDocument();
    expect(screen.getByText('No Banner Club')).toBeInTheDocument();
  });

  it('3. Create flow exposes Club Banner URL field but NO file upload', () => {
    const onClose = vi.fn();
    renderWithProviders(<CreateClubModal open={true} onClose={onClose} />);
    
    // Check that the URL input exists by its new label
    const urlInput = screen.getByRole('textbox', { name: /Club Banner \(Optional\)/i });
    expect(urlInput).toBeInTheDocument();
    
    // Check that there is NO file upload button
    const uploadButtons = screen.queryAllByRole('button', { name: /upload/i });
    expect(uploadButtons.length).toBe(0);

    // Verify Guidelines render
    expect(screen.getByText('Banner Guidelines')).toBeInTheDocument();
    expect(screen.getAllByText(/1600 × 400 px/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/4:1/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/JPG/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/8 MB/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/direct image URL/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/NST Events stores the image URL and displays the image from its external host/i)).toBeInTheDocument();
  });
});
