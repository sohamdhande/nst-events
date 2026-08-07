# Notification Data Model

## Strategy
Push notifications are ephemeral via Expo Push Delivery; in-app notifications are persistent. Push delivery requires a stored Expo push token per device, which is managed separately from the notification inbox.

## Tables
* **`notifications`**: Persistent inbox. Includes `read_at` timestamp and delivery tracking fields (`delivered_at`, `delivery_failed_at`, `delivery_error`).
* **`notification_preferences`**: Allows users to opt-out of specific notification types (e.g., "mute club announcements"). Controls whether `push_enabled` is true/false per category.
  * **Lifecycle**: No row is required during user creation. `GET /notifications/preferences` returns schema defaults when no row exists. `PATCH /notifications/preferences` performs an upsert. Once persisted, subsequent reads return the stored values.
* **`push_tokens`**: Stores Expo push tokens per device. One row per `(user_id, device_id)` pair. Upserted on login, hard-deleted when Expo returns `DeviceNotRegistered`, and periodically cleaned up by `pg_cron` for tokens idle >90 days. This table is **required** for nst-worker to dispatch push notifications — without it, the worker has no delivery address for a given user's device.
* **`notification_jobs`**: Native PostgreSQL job queue replacing the native queue extension. Handles background scheduling and retry state tracking for Expo push delivery.

## Native Queue Data Model (`notification_jobs`)

The system uses a standard SQL table for background job scheduling.

**Schema:**
- `id`: UUID (Primary Key)
- `status`: String (`PENDING`, `PROCESSING`, `WAITING_FOR_RECEIPTS`, `COMPLETED`, `RETRY_PENDING`, `FAILED`, `DEAD_LETTER`, `ARCHIVED`)
- `payload`: JSONB (See Queue Payload Contract)
- `priority`: String (`HIGH`, `NORMAL`)
- `attempt_count`: Integer (Default 0)
- `max_attempts`: Integer (Default 4)
- `available_at`: TIMESTAMPTZ (Index for polling)
- `locked_at`: TIMESTAMPTZ (Tracks claim time)
- `worker_id`: String (Nullable, tracks which pod claimed the job)
- `idempotency_key`: String (Unique constraint)
- `ticket_ids`: JSONB (Nullable. Stores Expo ticket IDs while waiting for receipts. Cleared upon terminal state.)
- `last_error`: Text (Stores only execution failures and error diagnostics)
- `created_at`: TIMESTAMPTZ
- `updated_at`: TIMESTAMPTZ

**Indexes:**
- `CREATE INDEX idx_notification_jobs_poll ON notification_jobs (status, available_at) WHERE status IN ('PENDING', 'RETRY_PENDING');`
- `CREATE UNIQUE INDEX idx_notification_jobs_idempotent ON notification_jobs (idempotency_key);`

**Constraints:**
- Status enum enforcement (`CHECK status IN ('PENDING', 'PROCESSING', 'WAITING_FOR_RECEIPTS', 'COMPLETED', 'RETRY_PENDING', 'FAILED', 'DEAD_LETTER', 'ARCHIVED')`).
- Enqueue logic enforces that duplicate `idempotency_key` inserts are ignored (`ON CONFLICT DO NOTHING`).

**Foreign Keys:**
- **NONE**. The `notification_jobs` table intentionally has **NO foreign keys**. 
- *Why?* This is a high-throughput, transient queue table decoupled from the business domain. The `payload` contains the `user_id` and `notification_type`. If a user or event is deleted, adding foreign keys would cause severe lock contention and cascading delete performance hits. The worker handles missing entities gracefully by marking the job as `ARCHIVED`.

**Cleanup Rules (Lifecycle):**
- **Eligible Statuses**: `COMPLETED`, `ARCHIVED`
- **Retention Period**: 7 days
- **Cadence**: Daily at 02:00 AM UTC
- **Mechanism**: `pg_cron` execution of `DELETE FROM notification_jobs WHERE status IN ('COMPLETED', 'ARCHIVED') AND updated_at < now() - interval '7 days';`
- **Preservation**: `RETRY_PENDING` and `FAILED` jobs are preserved.
- **DEAD_LETTER Retention**: `DEAD_LETTER` jobs have infinite retention until manually purged by a Platform Admin.
- **Action**: Physical deletion from the database.

**Ticket Cleanup Rules:**
The `ticket_ids` JSONB field must be cleared (set to NULL) whenever the job transitions out of `WAITING_FOR_RECEIPTS` into a terminal or retry state.
- Cleared after successful receipt processing (`COMPLETED`)
- Cleared after receipt processing fails (`FAILED`)
- Cleared after `DEAD_LETTER`
- Cleared after `ARCHIVED`
No stale ticket IDs remain.

## Dead Letter Queue Strategy
Instead of moving records to a separate `notification_jobs_dead_letter` table (Option A), the system uses **Option B (`status='DEAD_LETTER'`)**. 

**Why:** Using a `status` mutation prevents the overhead of INSERT+DELETE across tables. It natively preserves the foreign keys, creation timestamps, and error traces inside the same table, making it trivially queryable for the Platform Admin UI (`SELECT * FROM notification_jobs WHERE status = 'DEAD_LETTER'`).

## Notification Lifecycle
The persistent in-app notification records transition through the following states in the database (distinct from worker execution states):

- **UNREAD**: `read_at` is NULL. The notification has been created but not yet viewed by the user.
- **READ**: `read_at` is populated. The user has viewed the notification or marked all as read.
- **DELIVERED**: `delivered_at` is populated. The push notification was successfully handed off to the Expo API.
- **FAILED**: `delivery_failed_at` is populated. Push notification delivery failed permanently (e.g., DLQ reached, or `DeviceNotRegistered`).
- **ARCHIVED**: The notification is soft-deleted or removed from the active query scope by the user.

## Deep Link Contract
Every notification supports a deep link schema enabling direct navigation to the relevant screen when tapped.

**Fields:**
- `target`: The canonical deep link path template (e.g., `/approvals/{event_id}`).
- `params`: Dynamic parameters used to hydrate the target URL.
- `fallback`: Route to use if the target entity is deleted, expired, or unknown.
- `permissions`: Roles required to access the target (front-end check).

**Edge Cases:**
- *Unknown Routes*: Navigate to `/notifications` (Inbox).
- *Deleted/Expired Entities*: Navigate to the `fallback` route and display a toast ("This item is no longer available").
- *Version Compatibility*: The mobile app ignores unknown param fields but enforces `target` routing if the route is registered in Expo Router.

**Example:**
```json
{
  "target": "/approvals/{event_id}",
  "fallback": "/approvals",
  "params": {
    "event_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479"
  },
  "permissions": ["FACULTY_MENTOR", "CLUB_ADMIN"]
}
```

## Notification Metadata Schema
The `metadata` JSONB column in the `notifications` table MUST adhere strictly to this schema. 

```json
{
  "schema_version": 1,
  "routing": {
    "target": "/events/{event_id}",
    "fallback": "/events",
    "params": {
      "event_id": "uuid"
    }
  },
  "entity_ids": {
    "event_id": "uuid?",
    "club_id": "uuid?",
    "dispute_id": "uuid?",
    "attendance_id": "uuid?",
    "announcement_id": "uuid?"
  },
  "action_payload": {
    "role": "string?",
    "status": "string?"
  }
}
```

## Queue Payload Contract
All RPC producers enqueue messages to the `notification_jobs` table using the following strict JSON schema for the `payload` column.

**Schema:**
```json
{
  "schema_version": 1,
  "job_type": "SEND_PUSH",
  "notification_type": "WAITLIST_PROMOTED",
  "user_id": "uuid",
  "title": "You're off the waitlist!",
  "body": "You have been promoted to a registered spot for Event Name.",
  "metadata": { /* matches Notification Metadata Schema */ },
  "delivery_channel": "PUSH_AND_INAPP"
}
```
**Responsibilities:**
- **Producer (RPC/Express)**: Must generate a valid `idempotency_key` via `SHA256(notification_type + user_id + primary_entity_id + logical_event)` and insert a row into `notification_jobs` with `status = 'PENDING'` and `job_type = 'SEND_PUSH'`.
- **Consumer (Worker)**: Parses the `payload` JSONB and uses the `job_type` in conjunction with `status` to determine execution logic. Never mutates the payload. Fetches push tokens for `user_id`. Persists the notification to the DB. Sends push payload to Expo if `push_enabled` preferences allow and tokens exist. Manages explicit `status`, `ticket_ids`, and `available_at` mutations for the retry state machine.

## Push Token Flow
1. Mobile app obtains an Expo push token via `expo-notifications`.
2. On first authenticated request (or after token rotation), the mobile app sends the token to Express via `PATCH /users/me` or a dedicated endpoint.
3. Express upserts a `push_tokens` row: `ON CONFLICT (user_id, device_id) DO UPDATE SET expo_token = $3, last_seen_at = now()`.
4. When `nst-worker` dispatches a push notification, it queries `push_tokens WHERE user_id = $1` to get all active device tokens for that user.
5. If Expo returns `DeviceNotRegistered` for a specific token, nst-worker hard-deletes that `push_tokens` row.
