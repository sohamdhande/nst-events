// @vitest-environment jsdom
import { expect, describe, it, vi, beforeEach, afterEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import CreateEventPage from '../app/(app)/events/create/page';
import * as useCurrentUserHook from '../hooks/useCurrentUser';
import * as useClubsHook from '../hooks/useClubs';
import * as useAcademicBatchesHook from '../hooks/useAcademicBatches';
import * as useCreateEventHook from '../hooks/useCreateEvent';
import { App } from 'antd';
import { useRouter } from 'next/navigation';

// Setup basic mocks
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
}));

vi.mock('../hooks/useCurrentUser');
vi.mock('../hooks/useClubs');
vi.mock('../hooks/useAcademicBatches');
vi.mock('../hooks/useCreateEvent');
vi.mock('antd/es/app', () => ({
  App: {
    useApp: () => ({
      message: { success: vi.fn(), error: vi.fn() },
      modal: { confirm: vi.fn(), warning: vi.fn() }
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
      <App>{ui}</App>
    </QueryClientProvider>
  );
};

describe('Event Creation Workflow - Collaborating Clubs (WEB-55)', () => {
  let mockMutateAsync: any;
  let mockSubmitApproval: any;
  let mockPush: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockMutateAsync = vi.fn().mockResolvedValue({ id: 'new-event-1' });
    mockSubmitApproval = vi.fn().mockResolvedValue({});
    mockPush = vi.fn();

    vi.mocked(useRouter).mockReturnValue({
      push: mockPush,
    } as any);

    vi.spyOn(useCreateEventHook, 'useCreateEvent').mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
    } as any);

    vi.spyOn(useCreateEventHook, 'useSubmitEventForApproval').mockReturnValue({
      mutateAsync: mockSubmitApproval,
      isPending: false,
    } as any);

    vi.spyOn(useAcademicBatchesHook, 'useAcademicBatches').mockReturnValue({
      data: [{ id: 'batch-1', display_name: 'Batch 2026' }],
      isLoading: false,
    } as any);

    // Default to a Global Admin so all clubs are available
    vi.spyOn(useCurrentUserHook, 'useCurrentUser').mockReturnValue({
      data: { id: 'user-1', global_role: 'PLATFORM_ADMIN' },
      isLoading: false,
    } as any);

    vi.spyOn(useClubsHook, 'useClubs').mockReturnValue({
      data: {
        data: [
          { id: 'club-1', name: 'Dev Club' },
          { id: 'club-2', name: 'AI Club' },
          { id: 'club-3', name: 'Robotics Club' },
        ],
      },
      isLoading: false,
    } as any);
  });

  afterEach(() => {
    cleanup();
  });

  it('1. Collaborating Clubs field renders', async () => {
    renderWithProviders(<CreateEventPage />);
    
    // Field should exist
    expect(screen.getByText('Collaborating Clubs')).toBeInTheDocument();
  });

});
