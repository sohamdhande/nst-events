// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import React, { Suspense } from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import { resolveEventLockState } from '../lib/event-utils';
import { resolveManagementActions } from '../lib/action-utils';
import { Event } from '../hooks/useEvents';

// Mock react's use to just return the resolved value to avoid Suspense issues in tests
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return {
    ...actual,
    use: (promise: any) => {
      if (promise && promise.id) return promise; // If it's just the object, return it (hack for our test)
      // For real promises, React's `use` handles it, but in jsdom tests we can just mock it to return the mock value.
      return { id: 'evt_123' };
    },
  };
});

import EventDetailPage from '../app/(app)/events/[id]/page';
import { useEventDetail } from '../hooks/useEventDetail';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { useEventLifecycle } from '../hooks/useEventLifecycle';

// Mock all the hooks
vi.mock('../hooks/useEventDetail', () => ({
  useEventDetail: vi.fn(),
}));

vi.mock('../hooks/useCurrentUser', () => ({
  useCurrentUser: vi.fn(),
}));

vi.mock('../hooks/useEventLifecycle', () => ({
  useEventLifecycle: vi.fn(),
}));

vi.mock('../hooks/useEventLiveUpdates', () => ({
  useEventLiveUpdates: vi.fn(),
}));

// Mock antd App to avoid context errors
vi.mock('antd', async (importOriginal) => {
  const actual = await importOriginal<typeof import('antd')>();
  return {
    ...actual,
    App: {
      useApp: () => ({ message: { success: vi.fn(), error: vi.fn() } })
    }
  };
});

const baseEvent = {
  id: 'evt_123',
  title: 'Test Event',
  state: 'PUBLISHED',
  isLocked: false,
  startTime: new Date().toISOString(),
  endTime: new Date().toISOString(),
  lock_deadline: new Date().toISOString(),
} as unknown as Pick<Event, 'lock_state'> & Event;

const adminRoles = { isGlobalAdmin: true, isMentor: false, isClubAdmin: false, isCoreMember: false };
const studentRoles = { isGlobalAdmin: false, isMentor: false, isClubAdmin: false, isCoreMember: false };

describe('Event Lock Consistency (WEB-36A & WEB-50)', () => {
  it('resolves UNLOCKED correctly', () => {
    const event = { ...baseEvent, lock_state: 'UNLOCKED' as const };
    expect(resolveEventLockState(event)).toBe('UNLOCKED');
  });

  it('resolves MANUALLY_LOCKED correctly', () => {
    const event = { ...baseEvent, lock_state: 'MANUALLY_LOCKED' as const };
    expect(resolveEventLockState(event)).toBe('MANUALLY_LOCKED');
  });

  it('resolves PERMANENTLY_LOCKED correctly', () => {
    const event = { ...baseEvent, lock_state: 'PERMANENTLY_LOCKED' as const };
    expect(resolveEventLockState(event)).toBe('PERMANENTLY_LOCKED');
  });

  describe('Action Center', () => {
    it('creates Unlock action for MANUALLY_LOCKED if authorized', () => {
      const event = { ...baseEvent, lock_state: 'MANUALLY_LOCKED' as const };
      const actions = resolveManagementActions({ type: 'EVENT', data: event, currentUserRoles: adminRoles });
      expect(actions.find(a => a.id === `event-${event.id}-unlock`)).toBeDefined();
    });

    it('does NOT create Unlock action for MANUALLY_LOCKED if unauthorized', () => {
      const event = { ...baseEvent, lock_state: 'MANUALLY_LOCKED' as const };
      const actions = resolveManagementActions({ type: 'EVENT', data: event, currentUserRoles: studentRoles });
      expect(actions.find(a => a.id === `event-${event.id}-unlock`)).toBeUndefined();
    });

    it('does NOT create Unlock action for PERMANENTLY_LOCKED even if authorized', () => {
      const event = { ...baseEvent, lock_state: 'PERMANENTLY_LOCKED' as const };
      const actions = resolveManagementActions({ type: 'EVENT', data: event, currentUserRoles: adminRoles });
      expect(actions.find(a => a.id === `event-${event.id}-unlock`)).toBeUndefined();
    });

    it('does NOT create Unlock action for UNLOCKED', () => {
      const event = { ...baseEvent, lock_state: 'UNLOCKED' as const };
      const actions = resolveManagementActions({ type: 'EVENT', data: event, currentUserRoles: adminRoles });
      expect(actions.find(a => a.id === `event-${event.id}-unlock`)).toBeUndefined();
    });
  });

  describe('EventDetailPage DOM Tests', () => {
    const mockMutateUnlock = vi.fn();
    const mockMutateLock = vi.fn();

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
    });

    beforeEach(() => {
      vi.clearAllMocks();
      
      (useEventLifecycle as any).mockReturnValue({
        submitMutation: { isPending: false, mutate: vi.fn() },
        approveMutation: { isPending: false, mutate: vi.fn() },
        rejectMutation: { isPending: false, mutate: vi.fn() },
        lockMutation: { isPending: false, mutate: mockMutateLock },
        unlockMutation: { isPending: false, mutate: mockMutateUnlock },
      });
    });

    afterEach(() => {
      cleanup();
    });

    const renderEventPage = async (lockState: 'UNLOCKED' | 'MANUALLY_LOCKED' | 'PERMANENTLY_LOCKED', isGlobalAdmin: boolean) => {
      (useEventDetail as any).mockReturnValue({
        data: { ...baseEvent, lock_state: lockState },
        isLoading: false,
        isError: false,
      });

      (useCurrentUser as any).mockReturnValue({
        data: { global_role: isGlobalAdmin ? 'PLATFORM_ADMIN' : 'STUDENT', club_memberships: [] },
      });

      render(
        <EventDetailPage params={{ id: 'evt_123' } as any} />
      );
      
      await screen.findByRole('heading', { name: 'Test Event', level: 1 });
    };

    it('1. UNLOCKED + canLock -> Lock Event visible', async () => {
      await renderEventPage('UNLOCKED', true);
      expect(screen.getByRole('button', { name: /lock event/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /unlock event/i })).not.toBeInTheDocument();
    });

    it('2. UNLOCKED + !canLock -> Lock Event hidden', async () => {
      await renderEventPage('UNLOCKED', false);
      expect(screen.queryByRole('button', { name: /lock event/i })).not.toBeInTheDocument();
    });

    it('3. MANUALLY_LOCKED + canUnlock -> Unlock Event visible', async () => {
      await renderEventPage('MANUALLY_LOCKED', true);
      expect(screen.getByRole('button', { name: /unlock event/i })).toBeInTheDocument();
    });

    it('4. MANUALLY_LOCKED + !canUnlock -> Unlock Event hidden', async () => {
      await renderEventPage('MANUALLY_LOCKED', false);
      expect(screen.queryByRole('button', { name: /unlock event/i })).not.toBeInTheDocument();
    });

    it('5. PERMANENTLY_LOCKED + canUnlock -> Unlock Event hidden', async () => {
      await renderEventPage('PERMANENTLY_LOCKED', true);
      expect(screen.queryByRole('button', { name: /unlock event/i })).not.toBeInTheDocument();
    });

    it('6. PERMANENTLY_LOCKED -> Lock Event hidden', async () => {
      await renderEventPage('PERMANENTLY_LOCKED', true);
      expect(screen.queryByRole('button', { name: /lock event/i })).not.toBeInTheDocument();
    });

    it('7. MANUALLY_LOCKED -> LOCKED — READ-ONLY visible', async () => {
      await renderEventPage('MANUALLY_LOCKED', true);
      expect(screen.getByText('LOCKED — READ-ONLY')).toBeInTheDocument();
    });

    it('8. PERMANENTLY_LOCKED -> PERMANENTLY LOCKED — READ-ONLY visible', async () => {
      await renderEventPage('PERMANENTLY_LOCKED', true);
      expect(screen.getByText('PERMANENTLY LOCKED — READ-ONLY')).toBeInTheDocument();
    });
    
    it('9. Successful unlock uses unlockMutation from useEventLifecycle', async () => {
      await renderEventPage('MANUALLY_LOCKED', true);
      const unlockBtn = screen.getByRole('button', { name: /unlock event/i });
      fireEvent.click(unlockBtn);
      
      expect(mockMutateUnlock).toHaveBeenCalledWith('evt_123', expect.any(Object));
    });

    it('10. Subtitle is "live and editable" when UNLOCKED', async () => {
      await renderEventPage('UNLOCKED', true);
      expect(screen.getByText('This event is live and editable.')).toBeInTheDocument();
    });

    it('11. Subtitle is "locked and read-only" when MANUALLY_LOCKED', async () => {
      await renderEventPage('MANUALLY_LOCKED', true);
      expect(screen.getByText('This event is locked and read-only.')).toBeInTheDocument();
    });

    it('12. Subtitle is "permanently locked and read-only" when PERMANENTLY_LOCKED', async () => {
      await renderEventPage('PERMANENTLY_LOCKED', true);
      expect(screen.getByText('This event is permanently locked and read-only.')).toBeInTheDocument();
    });
  });
});
