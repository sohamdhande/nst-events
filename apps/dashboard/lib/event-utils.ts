import { Event, EventLockState } from '../hooks/useEvents';

export function resolveEventLockState(event: Pick<Event, 'lock_state'>): EventLockState {
  return event?.lock_state || 'UNLOCKED';
}
