// @vitest-environment jsdom
import { expect, describe, it, vi, beforeEach, afterEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ClubsDirectoryPage from '../app/(app)/clubs/page';
import { EditClubModal } from '../app/(app)/clubs/EditClubModal';
import * as useCurrentUserHook from '../hooks/useCurrentUser';
import * as useClubsHook from '../hooks/useClubs';
import * as useUpdateClubHook from '../hooks/useUpdateClub';
import { App } from 'antd';

// Setup basic mocks
vi.mock('../hooks/useCurrentUser');
vi.mock('../hooks/useClubs');
vi.mock('../hooks/useUpdateClub');
vi.mock('antd/es/app', () => ({
  App: {
    useApp: () => ({
      message: { success: vi.fn(), error: vi.fn() },
    }),
  },
}));

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
      <App>{ui}</App>
    </QueryClientProvider>
  );
};

const mockClub = {
  id: 'club-1',
  name: 'Test Club',
  description: 'Test description',
  status: 'ACTIVE' as const,
  banner_url: 'https://example.com/banner.jpg',
  event_count: 5,
  member_count: 10,
};

describe('Club Editing Workflow (WEB-39B)', () => {
  let mockMutateAsync: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockMutateAsync = vi.fn();

    vi.spyOn(useUpdateClubHook, 'useUpdateClub').mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
    } as any);

    vi.spyOn(useClubsHook, 'useClubs').mockReturnValue({
      data: { data: [mockClub] },
      isLoading: false,
    } as any);
  });

  afterEach(() => {
    cleanup();
  });

  const setPlatformAdmin = () => {
    vi.spyOn(useCurrentUserHook, 'useCurrentUser').mockReturnValue({
      data: { global_role: 'PLATFORM_ADMIN', club_memberships: [] },
    } as any);
  };

  const setFacultyAdmin = () => {
    vi.spyOn(useCurrentUserHook, 'useCurrentUser').mockReturnValue({
      data: { global_role: 'FACULTY_ADMIN', club_memberships: [] },
    } as any);
  };

  const setClubAdmin = () => {
    vi.spyOn(useCurrentUserHook, 'useCurrentUser').mockReturnValue({
      data: { 
        global_role: 'STUDENT', 
        club_memberships: [{ club_id: mockClub.id, role: 'CLUB_ADMIN' }] 
      },
    } as any);
  };

  const setStudent = () => {
    vi.spyOn(useCurrentUserHook, 'useCurrentUser').mockReturnValue({
      data: { global_role: 'STUDENT', club_memberships: [] },
    } as any);
  };

  it('1, 2, 3. Edit visible for PLATFORM_ADMIN, FACULTY_ADMIN, CLUB_ADMIN', () => {
    setPlatformAdmin();
    renderWithProviders(<ClubsDirectoryPage />);
    expect(screen.getByRole('button', { name: /Club Actions/i })).toBeInTheDocument();
    cleanup();

    setFacultyAdmin();
    renderWithProviders(<ClubsDirectoryPage />);
    expect(screen.getByRole('button', { name: /Club Actions/i })).toBeInTheDocument();
    cleanup();

    setClubAdmin();
    renderWithProviders(<ClubsDirectoryPage />);
    expect(screen.getByRole('button', { name: /Club Actions/i })).toBeInTheDocument();
  });

  it('4. Edit hidden for unauthorized user', () => {
    setStudent();
    renderWithProviders(<ClubsDirectoryPage />);
    expect(screen.queryByRole('button', { name: /Club Actions/i })).not.toBeInTheDocument();
  });

  it('5, 6, 7, 8. Modal opens and current values load', async () => {
    setPlatformAdmin();
    renderWithProviders(<ClubsDirectoryPage />);
    
    fireEvent.click(screen.getByRole('button', { name: /Club Actions/i }));
    fireEvent.click(await screen.findByText('Edit Club'));

    expect(await screen.findByRole('dialog', { name: /edit club/i })).toBeInTheDocument();
    
    expect(screen.getByDisplayValue(mockClub.name)).toBeInTheDocument();
    expect(screen.getByDisplayValue(mockClub.description)).toBeInTheDocument();
    expect(screen.getByDisplayValue(mockClub.banner_url)).toBeInTheDocument();
    
    // Verify Guidelines render
    expect(screen.getByText('Banner Guidelines')).toBeInTheDocument();
    expect(screen.getAllByText(/1600 × 400 px/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/4:1/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/JPG/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/8 MB/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/direct image URL/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/NST Events stores the image URL and displays the image from its external host/i)).toBeInTheDocument();
  });

  it('9. Name-only update sends only name', async () => {
    const onClose = vi.fn();
    renderWithProviders(<EditClubModal open={true} onClose={onClose} club={mockClub} />);
    
    const nameInput = screen.getByLabelText(/Club Name/i);
    fireEvent.change(nameInput, { target: { value: 'Updated Name' } });
    
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    
    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        id: mockClub.id,
        payload: { name: 'Updated Name' }
      });
    });
  });

  it('13, 14. Clearing description and banner sends null', async () => {
    const onClose = vi.fn();
    renderWithProviders(<EditClubModal open={true} onClose={onClose} club={mockClub} />);
    
    const descInput = screen.getByLabelText(/Description/i);
    fireEvent.change(descInput, { target: { value: '   ' } }); // clearing

    const bannerInput = screen.getByLabelText(/Club Banner/i);
    fireEvent.change(bannerInput, { target: { value: '' } }); // clearing
    
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    
    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        id: mockClub.id,
        payload: { description: null, banner_url: null }
      });
    });
  });

  it('12. Unchanged fields are omitted and 15. Unsupported fields are never sent', async () => {
    const onClose = vi.fn();
    renderWithProviders(<EditClubModal open={true} onClose={onClose} club={mockClub} />);
    
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    
    await waitFor(() => {
      // should just close without calling mutate if nothing changed
      expect(mockMutateAsync).not.toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });
  });
});
