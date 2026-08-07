# Soft Delete Strategy

## Mechanism
We implement soft deletes via a `deleted_at TIMESTAMPTZ` column.

## Why Soft Delete Exists
In an academic setting, records (like event registrations or clubs) are often requested to be restored after accidental deletion. Additionally, deleting a club should not orphan its historical attendance data, which is required for annual reporting.

## Implementation Rules
1. **Views**: We use `security_invoker = true` views (e.g., `active_events`) that automatically append `WHERE deleted_at IS NULL`. Client applications query the view, not the underlying table.
2. **INSTEAD OF DELETE triggers**: Attached to views to intercept `DELETE` statements and convert them to `UPDATE ... SET deleted_at = NOW()`.
3. **Partial Unique Indexes**: Prevent duplicate key errors for re-created entities by indexing only where `deleted_at IS NULL`.

## Cascade Behavior
Soft deletes must logically cascade. Cascade behavior is enforced at the **database level** via PostgreSQL trigger functions — **not** in the Express application layer. This ensures that soft-delete cascades execute correctly regardless of the entry path (API, background worker, direct DB maintenance, or RPC).

### Implementation Pattern
```sql
-- Example: cascade soft-delete from events to event_registrations
CREATE OR REPLACE FUNCTION cascade_event_soft_delete()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    UPDATE event_registrations SET deleted_at = NOW() WHERE event_id = NEW.id AND deleted_at IS NULL;
    UPDATE event_sessions SET deleted_at = NOW() WHERE event_id = NEW.id AND deleted_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_cascade_event_soft_delete
  AFTER UPDATE ON events
  FOR EACH ROW
  EXECUTE FUNCTION cascade_event_soft_delete();
```

### Cascade Map
* Soft-deleting an **event** cascades to: `event_registrations`, `event_sessions`, `teams`.
* Soft-deleting a **club** cascades to: `club_memberships`, `event_clubs` (and any events where the club was the sole host).
