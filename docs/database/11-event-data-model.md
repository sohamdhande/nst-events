# Event Data Model

## Tables
* **`events`**: Base generic table with `metadata jsonb`. The `state` column (`event_state_enum`) is the single source of truth for the approval lifecycle — no separate `event_approvals` table exists.
* **`event_clubs`**: Mapping table resolving M:N ownership.
* **`event_media`**: (Deferred to post-V1) References file storage bucket URLs when uploads are implemented. Not populated in V1 — events use placeholder banner images. Media URL fields on `events` are nullable.

> **Approval workflow note**: There is no `event_approvals` table. The full approval audit trail is captured in `audit_logs` (entity\_type = `'events'`, actions = `EVENT_SUBMITTED`, `EVENT_APPROVED`, `EVENT_REJECTED`). Every state transition calls an RPC that writes atomically to both `events.state` and `audit_logs`.

## State Lifecycle
The `event_status` enum drives the entire UI.

1. `DRAFT`: Club Admin is writing the description and uploading banners.
2. `PENDING_APPROVAL`: Submitted. Locked from Club Admin edits. Appears on Faculty Mentor dashboard.
3. `PUBLISHED`: Faculty approved. Event is visible on the student feed and accepts registrations.
4. `ARCHIVED`: Event date has passed. Locked from further attendance scans or registrations. Read-only for historical analytics.
