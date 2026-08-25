import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AppHomeScreen from '../app/(app)/index';
import EventScreen from '../app/(app)/events/[id]/index';
import TeamsScreen from '../app/(app)/events/[id]/teams';
import InvitationsScreen from '../app/(app)/invitations';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('expo-router', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useLocalSearchParams: () => ({ id: 'event-1', invitationId: 'inv-1' }),
}));

vi.mock('../src/infrastructure/network', () => ({
  useNetworkStatus: () => ({ isOnline: true }),
}));

vi.mock('../src/hooks/use-toast', () => ({
  useToast: () => ({ show: vi.fn() }),
}));

vi.mock('../src/infrastructure/api', () => ({
  apiClient: vi.fn(),
}));

import { apiClient } from '../src/infrastructure/api';
import { useAuthStore } from '../src/store/auth';

const createQueryClient = () => new QueryClient({
  defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
});

const withProviders = (ui: React.ReactElement) => (
  <QueryClientProvider client={createQueryClient()}>{ui}</QueryClientProvider>
);

describe('Phase UI-27: Student Event Discovery & Registration UX', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({ userId: 'user-1', isLoggedIn: true });
  });

  describe('Event Feed', () => {
    it('1. Event feed renders', async () => {
      (apiClient as any).mockResolvedValueOnce({
        data: [{ id: '1', title: 'Tech Talk', startTime: new Date().toISOString(), locationName: 'Auditorium', eventType: 'SEMINAR', registrationType: 'INDIVIDUAL', audience: 'ALL_STUDENTS', state: 'PUBLISHED' }],
        pagination: { has_more: false }
      });
      render(withProviders(<AppHomeScreen />));
      expect(await screen.findByText('Tech Talk')).toBeTruthy();
      expect(screen.getByText('Open to all students')).toBeTruthy();
    });

    it('2. Event feed loading', () => {
      (apiClient as any).mockImplementation(() => new Promise(() => {}));
      render(withProviders(<AppHomeScreen />));
      expect(screen.getAllByTestId('skeleton')).toBeTruthy(); // Assumes Skeleton renders something catchable, or we can check by tree
    });

    it('3. Event feed empty', async () => {
      (apiClient as any).mockResolvedValueOnce({ data: [], pagination: { has_more: false } });
      render(withProviders(<AppHomeScreen />));
      expect(await screen.findByText('No events available.')).toBeTruthy();
    });
  });

  describe('Event Detail', () => {
    it('4. Event detail loads & 5. ALL_STUDENTS display & 8. INDIVIDUAL registration button', async () => {
      (apiClient as any).mockImplementation(async (url: string) => {
        if (url === '/v1/events/event-1') return { id: 'event-1', title: 'Workshop', state: 'PUBLISHED', audience: 'ALL_STUDENTS', registration_type: 'INDIVIDUAL' };
        if (url === '/v1/events/event-1/my-registration') return { status: 'NONE' };
      });
      render(withProviders(<EventScreen />));
      expect(await screen.findByText('Workshop')).toBeTruthy();
      expect(screen.getByText('Open to all students')).toBeTruthy();
      expect(screen.getByText('Register')).toBeTruthy();
    });

    it('6. SPECIFIC_BATCHES generic display & 7. No raw audience UUID exposure', async () => {
      (apiClient as any).mockImplementation(async (url: string) => {
        if (url === '/v1/events/event-1') return { id: 'event-1', audience: 'SPECIFIC_BATCHES', audienceBatchIds: ['uuid-1', 'uuid-2'] };
        if (url === '/v1/events/event-1/my-registration') return { status: 'NONE' };
      });
      render(withProviders(<EventScreen />));
      expect(await screen.findByText('Targeted to selected batches')).toBeTruthy();
      expect(screen.queryByText('uuid-1')).toBeNull();
    });

    it('9. REGISTERED state', async () => {
      (apiClient as any).mockImplementation(async (url: string) => {
        if (url === '/v1/events/event-1') return { id: 'event-1', state: 'PUBLISHED', registration_type: 'INDIVIDUAL' };
        if (url === '/v1/events/event-1/my-registration') return { status: 'REGISTERED' };
      });
      render(withProviders(<EventScreen />));
      expect(await screen.findByText('Status: REGISTERED')).toBeTruthy();
      expect(screen.queryByText('Register')).toBeNull();
    });

    it('10. WAITLISTED state', async () => {
      (apiClient as any).mockImplementation(async (url: string) => {
        if (url === '/v1/events/event-1') return { id: 'event-1', state: 'PUBLISHED', registration_type: 'INDIVIDUAL' };
        if (url === '/v1/events/event-1/my-registration') return { status: 'WAITLISTED', waitlist_position: 5 };
      });
      render(withProviders(<EventScreen />));
      expect(await screen.findByText('Your team is waiting for event capacity. (Position: 5)')).toBeTruthy();
    });

    it('11. CANCELLED state', async () => {
      (apiClient as any).mockImplementation(async (url: string) => {
        if (url === '/v1/events/event-1') return { id: 'event-1', state: 'PUBLISHED', registration_type: 'INDIVIDUAL' };
        if (url === '/v1/events/event-1/my-registration') return { status: 'CANCELLED' };
      });
      render(withProviders(<EventScreen />));
      expect(await screen.findByText('Registration is cancelled.')).toBeTruthy();
    });

    it('20. Event lock hides mutations', async () => {
      (apiClient as any).mockImplementation(async (url: string) => {
        if (url === '/v1/events/event-1') return { id: 'event-1', state: 'PUBLISHED', registration_type: 'INDIVIDUAL', is_locked: true };
        if (url === '/v1/events/event-1/my-registration') return { status: 'REGISTERED' };
      });
      render(withProviders(<EventScreen />));
      expect(await screen.findByText('Event is locked')).toBeTruthy();
      expect(screen.queryByText('Cancel Registration')).toBeNull(); // Because locked
    });
    
    it('22. Audience rejection', async () => {
      (apiClient as any).mockImplementation(async (url: string, options?: any) => {
        if (url === '/v1/events/event-1') return { id: 'event-1', state: 'PUBLISHED', registration_type: 'INDIVIDUAL' };
        if (url === '/v1/events/event-1/my-registration') return { status: 'NONE' };
        if (url === '/v1/events/event-1/register') throw { status: 403, message: 'AUDIENCE_NOT_ELIGIBLE' };
      });
      render(withProviders(<EventScreen />));
      const btn = await screen.findByText('Register');
      fireEvent.press(btn);
      expect(await screen.findByText('This event is not available to your academic batch.')).toBeTruthy();
    });
  });

  describe('Team Management', () => {
    it('12. TEAM event shows Create Team', async () => {
      (apiClient as any).mockImplementation(async (url: string) => {
        if (url === '/v1/events/event-1') return { id: 'event-1', state: 'PUBLISHED', registration_type: 'TEAM' };
        if (url === '/v1/events/event-1/my-registration') return { status: 'NONE' };
      });
      render(withProviders(<EventScreen />));
      expect(await screen.findByText('Create Team')).toBeTruthy();
      expect(screen.queryByText('Register')).toBeNull();
    });

    it('13. Existing team shows Manage Team', async () => {
      (apiClient as any).mockImplementation(async (url: string) => {
        if (url === '/v1/events/event-1') return { id: 'event-1', state: 'PUBLISHED', registration_type: 'TEAM' };
        if (url === '/v1/events/event-1/my-registration') return { status: 'REGISTERED' };
      });
      render(withProviders(<EventScreen />));
      expect(await screen.findByText('Manage Team')).toBeTruthy();
    });

    it('14. Team rules render only when API provides them', async () => {
      (apiClient as any).mockImplementation(async (url: string) => {
        if (url === '/v1/events/event-1') return { id: 'event-1', registration_type: 'TEAM', metadata: { minimum_team_size: 2, maximum_team_size: 4 } };
        if (url === '/v1/events/event-1/my-registration') return { status: 'NONE' };
      });
      render(withProviders(<EventScreen />));
      expect(await screen.findByText(/Minimum: 2 • Maximum: 4/)).toBeTruthy();
    });

    it('15. FORMING state', async () => {
      (apiClient as any).mockImplementation(async (url: string) => {
        if (url === '/v1/events/event-1') return { id: 'event-1', registration_type: 'TEAM', metadata: { minimum_team_size: 3 } };
        if (url === '/v1/events/event-1/my-registration') return { status: 'FORMING' };
        if (url === '/v1/events/event-1/teams') return [{ id: 'team-1', name: 'Alpha', status: 'FORMING', member_count: 1, members: [{ user_id: 'user-1' }] }];
      });
      render(withProviders(<TeamsScreen />));
      expect(await screen.findByText('Your team is still forming.')).toBeTruthy();
      expect(screen.getByText('1 / 3 members (Max: ∞)')).toBeTruthy();
    });
  });

  describe('Invitations', () => {
    it('23. Invitation deep link isolates/highlights', async () => {
      (apiClient as any).mockImplementation(async (url: string) => {
        if (url === '/v1/users/me/team-invitations') return [
          { invitation_id: 'inv-1', team: { team_name: 'Alpha' }, event: { event_title: 'Hackathon' }, inviter: { full_name: 'John' }, expires_at: new Date(Date.now() + 100000).toISOString() },
          { invitation_id: 'inv-2', team: { team_name: 'Beta' }, event: { event_title: 'Workshop' }, inviter: { full_name: 'Jane' }, expires_at: new Date(Date.now() + 100000).toISOString() },
        ];
      });
      render(withProviders(<InvitationsScreen />));
      // Only inv-1 should be rendered due to invitationId deep link in mock
      expect(await screen.findByText('Alpha')).toBeTruthy();
      expect(screen.queryByText('Beta')).toBeNull();
    });
  });
});
