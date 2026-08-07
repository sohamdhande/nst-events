# 21. Realtime LISTEN/NOTIFY Contract

## 1. Purpose
This document is the single, canonical source of truth for the PostgreSQL `LISTEN/NOTIFY` infrastructure. It defines the strict boundary between the database, the Node.js API, and the SSE clients.

## 2. Architecture Boundary
- **PostgreSQL**: Emits stringified JSON payloads via `pg_notify` upon successful state transitions. It strictly owns the fan-out capability to ensure cross-replica consistency.
- **Node LISTEN Bridge**: The Express API uses a dedicated `pg` connection to `LISTEN` to database channels, parse the JSON, and emit local `EventEmitter` events. It does not queue, buffer, or persist events.
- **SSE Endpoint**: The `GET /events/:id/live` route subscribes to the local `EventEmitter` and streams the JSON to connected clients.

## 3. Channel Naming Contract
- Channels are **event-scoped**.
- **Format**: `event_<event_id>_live` (e.g., `event_123e4567-e89b-12d3-a456-426614174000_live`).
- **Immutability**: Channel naming is strictly frozen. No global channels or user-scoped channels may be added for this implementation.

## 4. Payload Contract
- All `pg_notify` payloads must be serialized as JSON strings.
- **Format**: `{"type": "<event_type>", "payload": <json_object>}`
- **Required Fields**: `type` (String) and `payload` (JSON Object).
- **Versioning**: Intentionally omitted. Schema changes require breaking API changes.

## 5. Event Types
The following event types are natively emitted by the database:
- `registration_count` (`{ count: number }`)
- `waitlist_update` (`{ user_id: string, status: string }`)

## 6. RPC Ownership Matrix
To prevent duplicated business logic, RPCs must natively emit notifications when they perform state transitions.

| RPC | Emits NOTIFY? | Event Type | Channel | Conditions |
|---|---|---|---|---|
| `register_event` | YES | `registration_count` | `event_<id>_live` | On successful REGISTERED state (waitlist does not increment count) |
| `cancel_registration` | YES | `registration_count` | `event_<id>_live` | On successful decrement |
| `create_team` | YES | `registration_count` | `event_<id>_live` | On successful team creation |
| `join_team` | YES | `registration_count` | `event_<id>_live` | On successful team join |
| `leave_team` | YES | `registration_count` | `event_<id>_live` | On successful team leave |
| `process_waitlist` | YES | `waitlist_update` | `event_<id>_live` | On promotion of a waitlisted user to REGISTERED |

## 7. Transaction Semantics
- **Commit Boundary**: `pg_notify` MUST execute inside the transaction block. PostgreSQL guarantees delivery to listeners *only after* the transaction issues a `COMMIT`.
- **Rollback Semantics**: If the transaction rolls back, the notification is silently discarded by PostgreSQL. Phantom events are impossible.
- **Duplicate Behaviour**: PostgreSQL naturally coalesces duplicate identical string payloads emitted on the same channel in the same transaction.
- **Delivery**: At-most-once from PG to Node. 

## 8. Event Ordering
When a parent RPC executes an internal RPC (e.g., `cancel_registration` invoking `process_waitlist`):
1. `waitlist_update` is emitted first (by the internal RPC).
2. `registration_count` is emitted second (by the parent RPC).
Notifications are delivered to the Node API in the exact order they were queued during the transaction.

## 9. Internal RPC Behaviour
Internal `SECURITY DEFINER` RPCs (e.g., `process_waitlist`) are explicitly authorized and required to emit `pg_notify`. This perfectly encapsulates the state transition logic and prevents parent RPCs from improperly inferring waitlist promotion.

## 10. SSE Bridge Responsibilities
The Node.js API must NEVER emit its own `registration_count` or `waitlist_update` events from HTTP handlers. All event emission is strictly delegated to the database. The Express API acts solely as a stateless stream forwarder.

## 11. Failure Semantics
- **Node Reconnect**: If the Node server drops its `pg` connection, it will automatically issue `LISTEN event_<id>_live` upon the next incoming SSE client request.
- **Missed Events**: The `LISTEN` bridge is stateless. Missed notifications are not buffered.
- **Client Reconnect**: Mobile clients handle dropped events by reconnecting, at which point the API must perform an absolute state query (`SELECT registration_count`) and stream the fresh state to the client.

## 12. Compatibility Rules
Any future additions to realtime events MUST be documented in this specific file before implementation. No external documentation may override these contracts.
