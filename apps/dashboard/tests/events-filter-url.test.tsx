// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, beforeAll, afterEach } from 'vitest';
import EventsPage from '../app/(app)/events/page';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useEvents } from '../hooks/useEvents';
import { useClubs } from '../hooks/useClubs';
import { useCurrentUser } from '../hooks/useCurrentUser';

// Mock dependencies
vi.mock('next/navigation', () => ({
  useSearchParams: vi.fn(),
  useRouter: vi.fn(),
  usePathname: vi.fn(),
}));

vi.mock('../hooks/useEvents', () => ({
  useEvents: vi.fn(),
}));

vi.mock('../hooks/useClubs', () => ({
  useClubs: vi.fn(),
}));

vi.mock('../hooks/useCurrentUser', () => ({
  useCurrentUser: vi.fn(),
}));

vi.mock('../hooks/useEventLifecycle', () => ({
  useEventLifecycle: () => ({
    submitMutation: { mutate: vi.fn() },
    approveMutation: { mutate: vi.fn() },
    rejectMutation: { mutate: vi.fn() },
    lockMutation: { mutate: vi.fn() },
    unlockMutation: { mutate: vi.fn() },
  }),
}));

const mockPush = vi.fn();
const mockReplace = vi.fn();

describe('Events Filter URL Integration', () => {
  beforeAll(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(), // deprecated
        removeListener: vi.fn(), // deprecated
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();

    (useRouter as any).mockReturnValue({
      push: mockPush,
      replace: mockReplace,
    });
    (usePathname as any).mockReturnValue('/events');

    // Default to no filters in URL
    const mockSearchParams = new URLSearchParams();
    (useSearchParams as any).mockReturnValue(mockSearchParams);

    (useCurrentUser as any).mockReturnValue({ data: null });
    (useClubs as any).mockReturnValue({ data: { data: [{ id: 'club-1', name: 'Dev Club' }] } });
    (useEvents as any).mockReturnValue({ data: { data: [] }, isLoading: false });
  });

  it('1. /events defaults to unfiltered', () => {
    render(<EventsPage />);
    expect(useEvents).toHaveBeenCalledWith({
      q: undefined,
      filter_state: undefined,
      filter_club_id: undefined,
    });
  });

  it('2. filter_club_id initializes Club filter', () => {
    const params = new URLSearchParams('?filter_club_id=club-1');
    (useSearchParams as any).mockReturnValue(params);

    render(<EventsPage />);
    expect(useEvents).toHaveBeenCalledWith(expect.objectContaining({
      filter_club_id: 'club-1',
    }));
  });

  it('3. filter_state initializes state filter', () => {
    const params = new URLSearchParams('?filter_state=PUBLISHED');
    (useSearchParams as any).mockReturnValue(params);

    render(<EventsPage />);
    expect(useEvents).toHaveBeenCalledWith(expect.objectContaining({
      filter_state: 'PUBLISHED',
    }));
  });

  it('4. q initializes search', () => {
    const params = new URLSearchParams('?q=hackathon');
    (useSearchParams as any).mockReturnValue(params);

    render(<EventsPage />);
    expect(useEvents).toHaveBeenCalledWith(expect.objectContaining({
      q: 'hackathon',
    }));
  });

  it('5. Search updates URL with replace', async () => {
    (useSearchParams as any).mockReturnValue({
      get: (k: string) => null,
      toString: () => ''
    });

    render(<EventsPage />);
    
    const searchInput = screen.getAllByPlaceholderText('Search events...')[0];
    fireEvent.change(searchInput, { target: { value: 'hackathon' } });
    
    const searchBtn = searchInput.parentElement?.parentElement?.querySelector('button.ant-input-search-btn');
    if (searchBtn) fireEvent.click(searchBtn);
    else fireEvent.keyDown(searchInput, { key: 'Enter', code: 'Enter', keyCode: 13, charCode: 13 });

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/events?q=hackathon');
    });
  });

  it('8. Existing query parameters are preserved when another filter changes', async () => {
    (useSearchParams as any).mockReturnValue({
      get: (k: string) => k === 'filter_club_id' ? 'club-1' : null,
      toString: () => 'filter_club_id=club-1'
    });

    render(<EventsPage />);
    
    const searchInput = screen.getAllByPlaceholderText('Search events...')[0];
    fireEvent.change(searchInput, { target: { value: 'hackathon' } });
    
    const searchBtn = searchInput.parentElement?.parentElement?.querySelector('button.ant-input-search-btn');
    if (searchBtn) fireEvent.click(searchBtn);
    else fireEvent.keyDown(searchInput, { key: 'Enter', code: 'Enter', keyCode: 13, charCode: 13 });

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/events?filter_club_id=club-1&q=hackathon');
    });
  });

  it('9. Clearing Club removes only filter_club_id', async () => {
    (useSearchParams as any).mockReturnValue({
      get: (k: string) => k === 'filter_club_id' ? 'club-1' : (k === 'q' ? 'hackathon' : null),
      toString: () => 'filter_club_id=club-1&q=hackathon'
    });

    render(<EventsPage />);
    
    const elements = screen.getAllByText('Showing events organized by Dev Club');
    const closeIcon = elements[0].parentElement?.querySelector('.anticon-close');
    expect(closeIcon).toBeInTheDocument();
    
    fireEvent.click(closeIcon!);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/events?q=hackathon');
    });
  });

  it('10. Clear All returns to /events', async () => {
    (useSearchParams as any).mockReturnValue({
      get: (k: string) => k === 'filter_club_id' ? 'club-1' : (k === 'q' ? 'hackathon' : null),
      toString: () => 'filter_club_id=club-1&q=hackathon'
    });

    render(<EventsPage />);
    
    const clearButton = screen.getAllByRole('button', { name: /clear filters/i })[0];
    fireEvent.click(clearButton);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/events');
    });
  });

  it('16. Active Club context is visible', () => {
    (useSearchParams as any).mockReturnValue({
      get: (k: string) => k === 'filter_club_id' ? 'club-1' : null,
      toString: () => 'filter_club_id=club-1'
    });

    render(<EventsPage />);
    expect(screen.getAllByText('Showing events organized by Dev Club').length).toBeGreaterThan(0);
  });
});
