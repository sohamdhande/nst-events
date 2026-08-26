// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import React, { use, Suspense } from 'react';
import { render, screen, waitFor, fireEvent, cleanup, act } from '@testing-library/react';
import { expect, test, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App, ConfigProvider } from 'antd';

import ClubDetailPage from '../app/(app)/clubs/[clubId]/page';

const mockClubId = 'club-123';
const mockUserId = 'user-1';

const mockClubDetail = {
  id: mockClubId,
  name: 'Test Club',
  description: 'A club for testing',
  banner_url: 'https://example.com/banner.jpg',
  status: 'ACTIVE',
  event_count: 5,
  members: [
    {
      user_id: mockUserId,
      role: 'CLUB_ADMIN',
      full_name: 'Admin User',
      avatar_url: null,
    },
    {
      user_id: 'user-2',
      role: 'MEMBER',
      full_name: 'Regular Member',
      avatar_url: null,
    },
    {
      user_id: 'user-3',
      role: 'FACULTY_MENTOR',
      full_name: 'Faculty User',
      avatar_url: null,
    }
  ]
};

const mockCurrentUser = {
  id: mockUserId,
  email: 'admin@test.com',
  global_role: 'STUDENT',
  club_memberships: [
    { club_id: mockClubId, role: 'CLUB_ADMIN' }
  ]
};

// --- Mocks ---
const { mockUseClubDetail, mockUseAddClubMember, mockUseUpdateClubMemberRole, mockUseRemoveClubMember, mockUseCurrentUser, mockUseUpdateClub } = vi.hoisted(() => ({
  mockUseClubDetail: vi.fn(),
  mockUseAddClubMember: vi.fn(),
  mockUseUpdateClubMemberRole: vi.fn(),
  mockUseRemoveClubMember: vi.fn(),
  mockUseCurrentUser: vi.fn(),
  mockUseUpdateClub: vi.fn(),
}));

vi.mock('../hooks/useClubDetail', () => ({
  useClubDetail: (...args: any[]) => mockUseClubDetail(...args),
  useAddClubMember: (...args: any[]) => mockUseAddClubMember(...args),
  useUpdateClubMemberRole: (...args: any[]) => mockUseUpdateClubMemberRole(...args),
  useRemoveClubMember: (...args: any[]) => mockUseRemoveClubMember(...args),
}));

vi.mock('../hooks/useCurrentUser', () => ({
  useCurrentUser: (...args: any[]) => mockUseCurrentUser(...args),
}));

vi.mock('../hooks/useUpdateClub', () => ({
  useUpdateClub: (...args: any[]) => mockUseUpdateClub(...args),
  useUpdateClubStatus: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
}));

const mockSearchParams = new URLSearchParams();
const mockRouterPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockRouterPush,
  }),
  useSearchParams: () => mockSearchParams,
  usePathname: () => `/clubs/${mockClubId}`,
  notFound: vi.fn(),
}));

beforeAll(() => {
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
  
  // Mock IntersectionObserver
  class IntersectionObserver {
    observe = vi.fn();
    disconnect = vi.fn();
    unobserve = vi.fn();
  }
  Object.defineProperty(window, 'IntersectionObserver', {
    writable: true,
    configurable: true,
    value: IntersectionObserver,
  });

  // Mock ResizeObserver
  class ResizeObserver {
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
  }
  Object.defineProperty(window, 'ResizeObserver', {
    writable: true,
    configurable: true,
    value: ResizeObserver,
  });
});

beforeEach(() => {
  mockUseClubDetail.mockReturnValue({
    data: mockClubDetail,
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  });

  mockUseCurrentUser.mockReturnValue({
    data: mockCurrentUser,
    isLoading: false,
  });

  mockUseUpdateClub.mockReturnValue({
    mutateAsync: vi.fn(),
    isPending: false,
  });

  mockUseAddClubMember.mockReturnValue({
    mutateAsync: vi.fn(),
    isPending: false,
  });

  mockUseUpdateClubMemberRole.mockReturnValue({
    mutateAsync: vi.fn(),
    isPending: false,
  });

  mockUseRemoveClubMember.mockReturnValue({
    mutateAsync: vi.fn(),
    isPending: false,
  });
});

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
  mockSearchParams.delete('tab');
  vi.clearAllMocks();
});

const renderWithProviders = async (ui: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  let rendered: any;
  await act(async () => {
    rendered = render(
      <QueryClientProvider client={queryClient}>
        <ConfigProvider>
          <App>
            <Suspense fallback={<div data-testid="suspense-fallback">Loading params...</div>}>
              {ui}
            </Suspense>
          </App>
        </ConfigProvider>
      </QueryClientProvider>
    );
  });
  return rendered;
};

const getMockParams = (id: string = mockClubId) => Promise.resolve({ clubId: id });

// ═══════════════════════════════════════════════
// 1. LOADING & SKELETON
// ═══════════════════════════════════════════════
test('Route renders loading skeleton', async () => {
  mockUseClubDetail.mockReturnValue({
    data: undefined,
    isLoading: true,
  });
  
  const { container } = await renderWithProviders(<ClubDetailPage params={getMockParams()} />);
  await waitFor(() => {
    expect(container.querySelector('.ant-skeleton')).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════
// 2. COMPACT CLUB HEADER
// ═══════════════════════════════════════════════
test('Compact Club header renders with initials avatar, name, description, and status', async () => {
  mockSearchParams.set('tab', 'overview');
  await renderWithProviders(<ClubDetailPage params={getMockParams()} />);
  await waitFor(() => {
    // Club name present (in header + possibly overview)
    expect(screen.getAllByText('Test Club').length).toBeGreaterThan(0);
    // Description
    expect(screen.getAllByText('A club for testing').length).toBeGreaterThan(0);
    // Initials avatar
    expect(screen.getByText('TC')).toBeInTheDocument();
    // Status tag shows "Active" (humanized)
    expect(screen.getAllByText(/Active/i).length).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════
// 3. NO BANNER FALLBACK (graceful omission)
// ═══════════════════════════════════════════════
test('No Banner fallback — no giant placeholder, just initials', async () => {
  mockUseClubDetail.mockReturnValue({
    data: { ...mockClubDetail, banner_url: null },
    isLoading: false,
  });
  
  await renderWithProviders(<ClubDetailPage params={getMockParams()} />);
  await waitFor(() => {
    // No banner image rendered at all
    expect(screen.queryByAltText(/banner/i)).not.toBeInTheDocument();
    // Initials still render
    expect(screen.getByText('TC')).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════
// 4. TAB NAVIGATION & URL STATE
// ═══════════════════════════════════════════════
test('All four tabs render and clicking pushes correct URL', async () => {
  await renderWithProviders(<ClubDetailPage params={getMockParams()} />);
  await waitFor(() => {
    expect(screen.getByRole('tab', { name: 'Overview' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Members' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Events' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Administration' })).toBeInTheDocument();
  });

  fireEvent.click(screen.getByRole('tab', { name: 'Members' }));
  expect(mockRouterPush).toHaveBeenCalledWith(`/clubs/${mockClubId}?tab=members`);
});

// ═══════════════════════════════════════════════
// 5. OVERVIEW — KPI CARDS & AUTHORITATIVE METRICS
// ═══════════════════════════════════════════════
test('Overview renders KPI cards with authoritative member count, event count, and status', async () => {
  mockSearchParams.set('tab', 'overview');
  await renderWithProviders(<ClubDetailPage params={getMockParams()} />);
  await waitFor(() => {
    // KPI labels (text is in DOM as mixed-case; CSS textTransform makes it uppercase visually)
    expect(screen.getByText('Total Members')).toBeInTheDocument();
    expect(screen.getByText('Total Events')).toBeInTheDocument();
    expect(screen.getByText('Current Status')).toBeInTheDocument();

    // Authoritative values
    expect(screen.getAllByText('3').length).toBeGreaterThan(0); // members.length = 3
    expect(screen.getAllByText('5').length).toBeGreaterThan(0); // event_count = 5
  });

  // No fake metrics
  expect(screen.queryByText('Upcoming Events')).not.toBeInTheDocument();
  expect(screen.queryByText('Past Events')).not.toBeInTheDocument();
  expect(screen.queryByText('Pending Actions')).not.toBeInTheDocument();
  expect(screen.queryByText('Recent Activity')).not.toBeInTheDocument();
});

// ═══════════════════════════════════════════════
// 6. OVERVIEW — CLUB INFORMATION & NAVIGATION SHORTCUTS
// ═══════════════════════════════════════════════
test('Overview shows Club Information section and Members/Events shortcuts', async () => {
  mockSearchParams.set('tab', 'overview');
  await renderWithProviders(<ClubDetailPage params={getMockParams()} />);
  await waitFor(() => {
    expect(screen.getByText('Club Information')).toBeInTheDocument();
    // View Members shortcut
    expect(screen.getByText(/View Members/i)).toBeInTheDocument();
    // View Events shortcut
    expect(screen.getByText(/View Events/i)).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════
// 7. MEMBERS TAB — HEADER, TOOLBAR, TABLE
// ═══════════════════════════════════════════════
test('Members tab renders with header, toolbar, search, filter, and full member list', async () => {
  mockSearchParams.set('tab', 'members');
  await renderWithProviders(<ClubDetailPage params={getMockParams()} />);
  await waitFor(() => {
    expect(screen.getByText('Members · 3')).toBeInTheDocument();
    expect(screen.getByText('Manage members and Club roles.')).toBeInTheDocument();
    expect(screen.getByText('Admin User')).toBeInTheDocument();
    expect(screen.getByText('Regular Member')).toBeInTheDocument();
    expect(screen.getByText('Faculty User')).toBeInTheDocument();
  });

  // Human-readable role tags
  expect(screen.getAllByText('Club Admin').length).toBeGreaterThan(0);
  expect(screen.getAllByText('Member').length).toBeGreaterThan(0);
  expect(screen.getAllByText('Faculty Mentor').length).toBeGreaterThan(0);

  // No fabricated columns
  expect(screen.queryByRole('columnheader', { name: 'Joined' })).not.toBeInTheDocument();
  expect(screen.queryByRole('columnheader', { name: 'Status' })).not.toBeInTheDocument();
  expect(screen.queryByRole('columnheader', { name: 'Email' })).not.toBeInTheDocument();

  // Search works
  const searchInput = screen.getByPlaceholderText('Search members...');
  fireEvent.change(searchInput, { target: { value: 'Regular' } });

  await waitFor(() => {
    expect(screen.getByText('Regular Member')).toBeInTheDocument();
    expect(screen.queryByText('Faculty User')).not.toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════
// 8. MEMBER ACTIONS — VIEW, CHANGE ROLE, REMOVE
// ═══════════════════════════════════════════════
test('Member action menu includes View, Change Role, and Remove with confirmation', async () => {
  mockSearchParams.set('tab', 'members');
  await renderWithProviders(<ClubDetailPage params={getMockParams()} />);
  await waitFor(() => {
    expect(screen.getByText('Admin User')).toBeInTheDocument();
  });

  const actionButtons = document.querySelectorAll('.ant-dropdown-trigger');
  expect(actionButtons.length).toBeGreaterThan(0);

  fireEvent.click(actionButtons[0]);

  await waitFor(() => {
    expect(screen.getByText('View Member')).toBeInTheDocument();
    expect(screen.getByText('Change Role')).toBeInTheDocument();
    expect(screen.getByText('Remove Member')).toBeInTheDocument();
  });

  // Open View Member drawer
  fireEvent.click(screen.getByText('View Member'));
  await waitFor(() => {
    expect(document.querySelector('.ant-drawer-title')?.textContent).toBe('View Member');
  });

  // Close drawer
  fireEvent.click(document.querySelector('.ant-drawer-close') as Element);

  // Open dropdown again for Remove
  fireEvent.click(actionButtons[0]);
  await waitFor(() => {
    expect(screen.getByText('Remove Member')).toBeInTheDocument();
  });

  fireEvent.click(screen.getByText('Remove Member'));
  await waitFor(() => {
    expect(screen.getByText(/Their platform account is not deleted/i)).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════
// 9. PERMISSION — CLUB_ADMIN SEES EDIT & ADD
// ═══════════════════════════════════════════════
test('CLUB_ADMIN sees Edit Club and + Add Member', async () => {
  mockSearchParams.set('tab', 'members');
  await renderWithProviders(<ClubDetailPage params={getMockParams()} />);
  await waitFor(() => {
    expect(screen.getByText('Edit Club')).toBeInTheDocument();
    expect(screen.getByText('+ Add Member')).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════
// 10. PERMISSION — PLATFORM_ADMIN SEES EDIT & ADD
// ═══════════════════════════════════════════════
test('PLATFORM_ADMIN sees Edit Club and + Add Member', async () => {
  mockSearchParams.set('tab', 'members');
  mockUseCurrentUser.mockReturnValue({
    data: { ...mockCurrentUser, global_role: 'PLATFORM_ADMIN', club_memberships: [] },
  });
  
  await renderWithProviders(<ClubDetailPage params={getMockParams()} />);
  await waitFor(() => {
    expect(screen.getByText('Edit Club')).toBeInTheDocument();
    expect(screen.getByText('+ Add Member')).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════
// 11. PERMISSION — UNAUTHORIZED CANNOT SEE EDIT/ADD
// ═══════════════════════════════════════════════
test('Unauthorized user does not see Edit Club or + Add Member', async () => {
  mockSearchParams.set('tab', 'members');
  mockUseCurrentUser.mockReturnValue({
    data: { ...mockCurrentUser, id: 'user-unauthorized', global_role: 'STUDENT', club_memberships: [] },
  });
  
  await renderWithProviders(<ClubDetailPage params={getMockParams()} />);
  await waitFor(() => {
    expect(screen.getAllByText('Test Club').length).toBeGreaterThan(0);
  });
  expect(screen.queryByText('Edit Club')).not.toBeInTheDocument();
  expect(screen.queryByText('+ Add Member')).not.toBeInTheDocument();
});

// ═══════════════════════════════════════════════
// 12. ADD MEMBER — UUID FLOW
// ═══════════════════════════════════════════════
test('Add Member uses UUID workflow with correct helper text', async () => {
  mockSearchParams.set('tab', 'members');
  await renderWithProviders(<ClubDetailPage params={getMockParams()} />);
  await waitFor(() => screen.getByText('+ Add Member'));

  fireEvent.click(screen.getByText('+ Add Member'));

  await waitFor(() => {
    expect(screen.getByText('Add Club Member')).toBeInTheDocument();
    expect(screen.getByText(/Enter the platform user ID provided by the user/i)).toBeInTheDocument();
    expect(screen.getByText(/Name and email lookup is not available to Club Administrators in V1/i)).toBeInTheDocument();
  });

  const idInput = screen.getByPlaceholderText("Enter the user's platform ID (UUID)");
  expect(idInput).toBeInTheDocument();
});

// ═══════════════════════════════════════════════
// 13. EVENTS TAB — BRIDGE CARD
// ═══════════════════════════════════════════════
test('Events tab renders bridge card with count and View Events link', async () => {
  mockSearchParams.set('tab', 'events');
  await renderWithProviders(<ClubDetailPage params={getMockParams()} />);
  await waitFor(() => {
    const link = screen.getByRole('link', { name: /View Events/i });
    expect(link).toHaveAttribute('href', `/events?filter_club_id=${mockClubId}`);
  });

  // Event count
  expect(screen.getByText('5 Total Events')).toBeInTheDocument();
  // Description
  expect(screen.getByText('Events organized by this club.')).toBeInTheDocument();

  // No fabricated data
  expect(screen.queryByText('Upcoming')).not.toBeInTheDocument();
  expect(screen.queryByText('Registration')).not.toBeInTheDocument();
});

// ═══════════════════════════════════════════════
// 14. ADMINISTRATION — FIELDS & STATUS PERMISSION
// ═══════════════════════════════════════════════
test('Administration tab renders supported fields; status mutation gated to PLATFORM_ADMIN', async () => {
  mockSearchParams.set('tab', 'administration');

  // As STUDENT/CLUB_ADMIN — no Change Status
  const { unmount } = await renderWithProviders(<ClubDetailPage params={getMockParams()} />);
  await waitFor(() => {
    expect(screen.getByText('Club Information')).toBeInTheDocument();
    expect(screen.getAllByText('Test Club').length).toBeGreaterThan(0);
  });
  expect(screen.queryByRole('button', { name: 'Change Status' })).not.toBeInTheDocument();
  unmount();

  // As PLATFORM_ADMIN — Change Status visible
  mockUseCurrentUser.mockReturnValue({
    data: { ...mockCurrentUser, global_role: 'PLATFORM_ADMIN', club_memberships: [] },
  });
  await renderWithProviders(<ClubDetailPage params={getMockParams()} />);
  await waitFor(() => {
    expect(screen.getByRole('button', { name: 'Change Status' })).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════
// 15. ERROR STATES
// ═══════════════════════════════════════════════
test('403 state', async () => {
  mockUseClubDetail.mockReturnValue({
    data: undefined,
    isError: true,
    isLoading: false,
    error: new Error('403 Forbidden')
  });

  await renderWithProviders(<ClubDetailPage params={getMockParams()} />);
  await waitFor(() => {
    expect(screen.getByText('Access Denied')).toBeInTheDocument();
    expect(screen.getByText('You do not have access to this club.')).toBeInTheDocument();
  });
});

test('Error state shows retry button', async () => {
  mockUseClubDetail.mockReturnValue({
    data: undefined,
    isError: true,
    isLoading: false,
    error: new Error('Internal Server Error')
  });

  await renderWithProviders(<ClubDetailPage params={getMockParams()} />);
  await waitFor(() => {
    expect(screen.getByText('Unable to load club')).toBeInTheDocument();
    expect(screen.getByText('Retry')).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════
// 16. TAB ISOLATION — No content leakage
// ═══════════════════════════════════════════════
test('Overview tab does not render Members table or Events bridge', async () => {
  mockSearchParams.set('tab', 'overview');
  await renderWithProviders(<ClubDetailPage params={getMockParams()} />);
  await waitFor(() => {
    expect(screen.getByText('Total Members')).toBeInTheDocument();
  });
  // Members toolbar should not be visible
  expect(screen.queryByText('Members · 3')).not.toBeInTheDocument();
  // Events bridge should not be visible
  expect(screen.queryByText('5 Total Events')).not.toBeInTheDocument();
});
