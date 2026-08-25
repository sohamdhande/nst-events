import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import EventScreen from '../app/(app)/events/[id]/index';
import TeamsScreen from '../app/(app)/events/[id]/teams';
import InvitationsScreen from '../app/(app)/invitations';
import { useAuthStore } from '../src/store/auth';
import { apiClient } from '../src/infrastructure/api';

// Mock dependencies
vi.mock('../src/infrastructure/api', () => ({
  apiClient: vi.fn(),
}));

vi.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: 'event-1' }),
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('../src/infrastructure/network', () => ({
  useNetworkStatus: () => ({ isOnline: true }),
}));

// Basic query client for testing
const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

describe('Mobile Team Workflow', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
    useAuthStore.setState({ userId: 'student-1', isLoggedIn: true });
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );

  describe('EventScreen (index.tsx)', () => {
    it('shows Team Registration and Create Team for team events', async () => {
      vi.mocked(apiClient).mockImplementation(async (url) => {
        if (url === '/v1/events/event-1') {
          return { id: 'event-1', title: 'Hackathon', registration_type: 'TEAM', state: 'PUBLISHED', metadata: { minimum_team_size: 2, maximum_team_size: 4 } };
        }
        if (url === '/v1/events/event-1/my-registration') {
          return { status: 'UNREGISTERED' };
        }
      });

      render(<EventScreen />, { wrapper });
      await waitFor(() => expect(screen.getByText('Team Registration')).toBeTruthy());
      expect(screen.getByText('Create Team')).toBeTruthy();
      expect(screen.queryByText('Register')).toBeNull(); // No individual register
    });

    it('shows Event Locked if event is locked', async () => {
      vi.mocked(apiClient).mockImplementation(async (url) => {
        if (url === '/v1/events/event-1') {
          return { id: 'event-1', registration_type: 'TEAM', state: 'PUBLISHED', is_locked: true };
        }
        if (url === '/v1/events/event-1/my-registration') {
          return { status: 'UNREGISTERED' };
        }
      });

      render(<EventScreen />, { wrapper });
      await waitFor(() => expect(screen.getByText('Event Locked')).toBeTruthy());
    });
  });

  describe('TeamsScreen', () => {
    it('renders FORMING state and leader actions', async () => {
      vi.mocked(apiClient).mockImplementation(async (url) => {
        if (url === '/v1/events/event-1') return { id: 'event-1', metadata: { minimum_team_size: 3 } };
        if (url === '/v1/events/event-1/my-registration') return { status: 'FORMING' };
        if (url === '/v1/events/event-1/teams') return [{
          id: 'team-1',
          name: 'Alpha Team',
          leader_id: 'student-1',
          member_count: 1,
          status: 'FORMING',
          members: [{ user_id: 'student-1', full_name: 'Student One' }]
        }];
        if (url.includes('/invitee-search')) return [];
      });

      render(<TeamsScreen />, { wrapper });
      await waitFor(() => expect(screen.getByText('Alpha Team')).toBeTruthy());
      
      expect(screen.getByText('FORMING')).toBeTruthy();
      expect(screen.getByText('👑')).toBeTruthy(); // Leader badge
      expect(screen.getByText('Invite Member')).toBeTruthy();
      
      // Below minimum banner should be visible
      expect(screen.getByText(/Team below minimum size/i)).toBeTruthy();
    });

    it('hides mutations when locked', async () => {
      vi.mocked(apiClient).mockImplementation(async (url) => {
        if (url === '/v1/events/event-1') return { id: 'event-1', is_locked: true };
        if (url === '/v1/events/event-1/my-registration') return { status: 'REGISTERED' };
        if (url === '/v1/events/event-1/teams') return [{
          id: 'team-1',
          name: 'Alpha Team',
          leader_id: 'student-1',
          member_count: 3,
          members: [{ user_id: 'student-1', full_name: 'Student One' }]
        }];
      });

      render(<TeamsScreen />, { wrapper });
      await waitFor(() => expect(screen.getByText('Alpha Team')).toBeTruthy());
      
      expect(screen.getByText(/no longer accepting team changes/i)).toBeTruthy();
      expect(screen.queryByText('Invite Member')).toBeNull();
      expect(screen.queryByText('Leave Team')).toBeNull();
    });
  });

  describe('InvitationsScreen', () => {
    it('displays pending invitations and handles expiry', async () => {
      const pastDate = new Date();
      pastDate.setHours(pastDate.getHours() - 1);
      
      const futureDate = new Date();
      futureDate.setHours(futureDate.getHours() + 1);

      vi.mocked(apiClient).mockImplementation(async (url) => {
        if (url === '/v1/users/me/team-invitations') return [
          {
            invitation_id: 'inv-1',
            status: 'PENDING',
            expires_at: futureDate.toISOString(),
            team: { team_id: 't-1', team_name: 'Future Team' },
            event: { event_id: 'e-1', event_title: 'Event A' },
            inviter: { full_name: 'Inviter' }
          },
          {
            invitation_id: 'inv-2',
            status: 'PENDING',
            expires_at: pastDate.toISOString(),
            team: { team_id: 't-2', team_name: 'Expired Team' },
            event: { event_id: 'e-1', event_title: 'Event A' },
            inviter: { full_name: 'Inviter' }
          }
        ];
      });

      render(<InvitationsScreen />, { wrapper });
      await waitFor(() => expect(screen.getByText('Future Team')).toBeTruthy());
      
      expect(screen.getByText('Expired Team')).toBeTruthy();
      expect(screen.getByText('Invitation expired.')).toBeTruthy();
      
      // Should only have Accept/Decline for the non-expired one
      expect(screen.getAllByText('Accept')).toHaveLength(1);
    });
  });
});
