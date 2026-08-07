# Registration Data Model

## Architecture
`event_registrations` is the canonical source of truth for registration state and team membership.

* **`event_registrations`**: Connects `user_id` to `event_id` and represents team membership via nullable `team_id`.
* **`teams`**: Represents a grouped entity with a `leader_id`.

## Team Leader Invariant
- A team always has exactly one leader.
- `leader_id` references an active (`deleted_at IS NULL`) registration belonging to the same team.
- The leader MUST have `registration_status = 'REGISTERED'`.
- A `WAITLISTED` registration can never become leader.

## Team Dissolution
If no `REGISTERED` members remain after the leader leaves:
- The team is soft-deleted.
- Every remaining `WAITLISTED` registration referencing that team is soft-deleted.
- `process_waitlist` must ignore registrations belonging to deleted teams.

## Registration–Team Invariant
For every active registration:
- if `team_id IS NOT NULL`, the referenced team MUST exist.
- if a team exists, it MUST have at least one active registration.

## Individual vs Team Registration
If an event allows teams, users create a `teams` record first, then their `event_registrations` row contains a non-null `team_id`. For individual registrations, `team_id` is null.

## Capacity Management & Waitlists
The `events` table contains `max_capacity` (nullable INTEGER; `NULL` means unlimited) and `registration_count` (INTEGER, default 0). When a student registers:

1. The `register_event` RPC executes a lock-free atomic capacity update:
   ```sql
   UPDATE events
   SET registration_count = registration_count + 1
   WHERE id = p_event_id
     AND (max_capacity IS NULL OR registration_count < max_capacity)
   RETURNING registration_count;
   ```
2. If a row is returned (capacity available or unlimited): inserts an `event_registrations` row with `registration_status = 'REGISTERED'`.
3. If 0 rows returned (event full): inserts with `registration_status = 'WAITLISTED'` (does NOT increment `registration_count`).
4. The entire operation is atomic within a single transaction.

### Lock-Free Atomic Increment Strategy
The atomic `UPDATE ... WHERE ... RETURNING` pattern ensures that concurrent requests from 500+ students at exactly the same millisecond do not oversell a limited-capacity event. This avoids `SELECT FOR UPDATE` lock contention while serializing capacity checks safely under high load.
