# Table Catalog

## `users`
* **Purpose**: Stores authenticated user identities and global roles.
* **Primary Key**: `id UUID` — internal platform identifier, generated at first login.
* **Key Columns**: `google_sub TEXT UNIQUE NOT NULL` — the stable OIDC subject identifier from Google (`sub` field in the `id_token`). Not a foreign key. Used to match returning users on each OAuth login.
* **Indexes**: `email` (UNIQUE B-Tree), `google_sub` (UNIQUE B-Tree)
* **RLS Notes**: Readable by self. Public profile fields (`full_name`, `avatar_url`) readable by all authenticated users.
* **Media Fields**: `avatar_url` (`TEXT`, nullable). Stores `NULL` in V1 — file uploads are deferred. Frontend renders a generated fallback (e.g., initials-based avatar) when `NULL`.

## `clubs`
* **Purpose**: Represents campus organizations.
* **Primary Key**: `id UUID`
* **Foreign Keys**: None
* **Indexes**: `name` (UNIQUE B-Tree), `to_tsvector` (GIN)
* **RLS Notes**: Readable by all. Updatable by Platform Admin.
* **Media Fields**: `banner_url` (`TEXT`, nullable). Stores `NULL` in V1 — file uploads are deferred. Frontend renders a placeholder banner when `NULL`.
* **`status` field**: Typed as `club_status_enum` (values: `ACTIVE`, `INACTIVE`, `DISSOLVED`). Default: `ACTIVE`. Only Platform Admin may transition status. A `DISSOLVED` club cannot be reactivated.

## `club_memberships`
* **Purpose**: Maps users to clubs and assigns contextual roles (Club Admin, Member, etc).
* **Primary Key**: `id UUID`
* **Foreign Keys**: `user_id`, `club_id`
* **Indexes**: Composite `(club_id, user_id)` (UNIQUE)
* **RLS Notes**: Readable by all. Updatable by Club Admin / Faculty.

## `events`
* **Purpose**: Core generic event data.
* **Primary Key**: `id UUID`
* **Foreign Keys**: `created_by` (users.id)
* **Indexes**: `start_time` (B-Tree), `metadata` (GIN), `location_geofence` (GiST)
* **RLS Notes**: Readable by all if PUBLISHED and PUBLIC. Updatable based on club_membership roles.
* **Additional Columns**: 
  * `attendance_type` (`attendance_type_enum NOT NULL DEFAULT 'SINGLE'`)
  * `is_locked` (`BOOLEAN NOT NULL DEFAULT false`)
  * `max_capacity` (`INTEGER` — nullable; `NULL` means unlimited capacity)
  * `registration_count` (`INTEGER NOT NULL DEFAULT 0` — atomically incremented by the `register_event` RPC via lock-free atomic increment: `UPDATE ... WHERE registration_count < max_capacity RETURNING registration_count`)

## `attendance_sessions`
* **Purpose**: Granular time blocks requiring check-in.
* **Primary Key**: `id UUID`
* **Foreign Keys**: `event_id`
* **Indexes**: `event_id` (B-Tree)
* **RLS Notes**: Same read policies as parent event.
* **Additional Columns**:
  * `open_at` (`TIMESTAMPTZ NOT NULL`)
  * `close_at` (`TIMESTAMPTZ NOT NULL`)
  * `geofence_radius` (`FLOAT NOT NULL DEFAULT 50`)

## `attendance_records`
* **Purpose**: Verified proof of physical presence.
* **Primary Key**: `id UUID`
* **Foreign Keys**: `session_id`, `user_id`
* **Indexes**: Composite `(session_id, user_id)` (UNIQUE)
* **RLS Notes**: Insertable via Express RPC only. Updatable only by Admins.
* **`status` field**: `attendance_status_enum` — values `PRESENT`, `ABSENT`, `EXCUSED`. `EXCUSED` is written exclusively by the `resolve_attendance_dispute` RPC when a dispute is approved. It is never written by the QR scan flow.
* **Additional Columns**:
  * `audit_metadata` (`JSONB` - Stores device_os, gps_accuracy, mock_location_detected, app_version)

## `event_registrations`
* **Purpose**: Tracks intent to attend (individual or team). Acts as the canonical source of truth for all event registrations and team membership.
* **Primary Key**: `id UUID`
* **Foreign Keys**: `event_id`, `user_id`, `team_id`
* **Indexes**: Composite `(event_id, user_id)` (UNIQUE), `(team_id, event_id)` (B-Tree)
* **Constraints**: `FOREIGN KEY (team_id, event_id) REFERENCES teams(id, event_id)` (Prevents cross-event team registrations).
* **RLS Notes**: Insertable by self. Readable by event organizers.

## `event_results`
Stores competition outcomes securely.
* `id` (uuid, pk)
* `event_id` (uuid, fk -> events.id)
* `user_id` (uuid, fk -> users.id)
* `result_type` (competition_result enum)
* `created_by` (uuid, fk -> users.id)
* `created_at` (timestamptz)

**Note on `event_registrations`:**
The `event_registrations` table has been upgraded to include a `participation_role` (enum) field.

## `attendance_disputes`
* **Purpose**: Tracks student-submitted attendance correction requests.
* **Columns**:
  * `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
  * `attendance_record_id UUID REFERENCES attendance_records(id)`
  * `session_id UUID REFERENCES attendance_sessions(id)`
  * `event_id UUID REFERENCES events(id)`
  * `user_id UUID REFERENCES users(id)`
  * `reason TEXT NOT NULL`
  * `evidence_urls TEXT[]`
  * `status dispute_status NOT NULL DEFAULT 'PENDING'`
  * `dispute_window_expires_at TIMESTAMPTZ NOT NULL`
* **Constraints**: `UNIQUE(session_id, user_id)` — One dispute per student per session.
  * `submitted_at TIMESTAMPTZ NOT NULL DEFAULT now()`
  * `reviewed_at TIMESTAMPTZ`
  * `reviewed_by UUID REFERENCES users(id)`
  * `review_notes TEXT`
  * `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`

## `leadership_handover_requests`
* **Purpose**: Manages stateful club leadership transfer workflow.
* **Columns**:
  * `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
  * `club_id UUID REFERENCES clubs(id)`
  * `initiated_by UUID REFERENCES users(id)`
  * `successor_id UUID REFERENCES users(id)`
  * `faculty_mentor_id UUID REFERENCES users(id)`
  * `status handover_status NOT NULL DEFAULT 'PENDING'`
  * `initiated_at TIMESTAMPTZ NOT NULL DEFAULT now()`
  * `reviewed_at TIMESTAMPTZ`
  * `review_notes TEXT`
  * `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`

## `club_leaderboard_mv` (Materialized View)
* **Purpose**: Derived club-level aggregate scores. Never written to directly.
* **Source**: Aggregated **ONLY** from the `leaderboard_scores` table.
* **Columns**:
  * `club_id UUID`
  * `club_name TEXT`
  * `total_points INTEGER`
  * `event_count INTEGER`
  * `member_count INTEGER`
  * `last_refreshed_at TIMESTAMPTZ`
* **Refresh strategy**: Refreshed asynchronously via a `pg_cron` scheduled job every **5 minutes** using `REFRESH MATERIALIZED VIEW CONCURRENTLY`. Materialized views are **never** refreshed by row-level triggers or on individual writes. Platform Admin may also trigger a manual refresh via `POST /admin/leaderboard/recalculate`.

## `student_leaderboard_mv` (Materialized View)
* **Purpose**: Derived per-student aggregate scores. Never written to directly.
* **Columns**:
  * `user_id UUID`
  * `display_name TEXT`
  * `total_points INTEGER`
  * `attendance_points INTEGER` (Intentionally deferred to V2, currently stubbed as 0)
  * `contribution_points INTEGER` (Intentionally deferred to V2, currently stubbed as 0)
  * `competition_points INTEGER` (Intentionally deferred to V2, currently stubbed as 0)
  * `last_refreshed_at TIMESTAMPTZ`
* **Refresh strategy**: Same as `club_leaderboard_mv` — refreshed asynchronously via `pg_cron` every **5 minutes**. Never refreshed on individual row writes.

## `refresh_tokens`
* **Purpose**: Stores hashed opaque refresh tokens for session management. Enables server-side session revocation.
* **Primary Key**: `id UUID`
* **Foreign Keys**: `user_id` (users.id, ON DELETE CASCADE)
* **Key Columns**:
  * `token_hash TEXT UNIQUE NOT NULL` — SHA-256 hash of the raw refresh token (raw token is never stored)
  * `family_id UUID NOT NULL` — Links rotated tokens together for family-wide revocation
  * `expires_at TIMESTAMPTZ NOT NULL` — 30-day TTL
  * `revoked_at TIMESTAMPTZ` — `NULL` means active; set on logout or compromise
  * `user_agent TEXT` — for session management display
  * `ip_address TEXT` — for anomaly detection (stored as TEXT; INET not used, Prisma-compatible)
* **Indexes**: `token_hash` (UNIQUE B-Tree), `user_id` (B-Tree)
* **RLS Notes**: Not client-accessible. Managed entirely by the Express authentication module via its dedicated service role.
* **Cleanup**: Expired and revoked rows are purged by a periodic pg_cron job.

## `push_tokens`
* **Purpose**: Stores Expo push tokens per device so `nst-worker` can dispatch push notifications to specific devices.
* **Primary Key**: `id UUID`
* **Foreign Keys**: `user_id` (users.id, ON DELETE CASCADE)
* **Key Columns**:
  * `device_id TEXT NOT NULL` — client-generated device identifier (same value as `audit_metadata.device_id` in attendance records)
  * `expo_token TEXT NOT NULL` — Expo push token (`ExponentPushToken[...]`)
  * `platform TEXT NOT NULL` — `'ios'` or `'android'`
  * `last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()` — updated on each successful authenticated API request
* **Constraints**: `UNIQUE(device_id)` — One device = one active push token. Token refresh triggers an UPSERT (`ON CONFLICT(device_id) DO UPDATE`), assigning it to the current user.
* **Indexes**: `user_id` (B-Tree), `device_id` (UNIQUE B-Tree)
* **RLS Notes**: Not client-accessible. No client SELECT policy. Managed entirely by Express (upsert on login) and nst-worker (hard-delete on `DeviceNotRegistered`).
* **Soft Delete**: No. Rows are hard-deleted.
* **Lifecycle**:
  * **On login/registration**: Express OAuth callback upserts using `(user_id, device_id)` as the conflict key.
  * **On `DeviceNotRegistered`**: nst-worker immediately hard-deletes the row; no further retry for that token.
  * **Stale cleanup**: `pg_cron` hard-deletes rows where `last_seen_at < now() - interval '90 days'`.


## `event_clubs`
* **Purpose**: Many-to-many relationship mapping an event to multiple clubs (for cross-club collaborations).
* **Primary Key**: `event_id, club_id`
* **Columns**:
  * `event_id UUID`
  * `club_id UUID`
  * `is_primary BOOLEAN` — Designates the lead organizing club

## `teams`
* **Purpose**: Tracks participant groups formed for hackathons or team-based events.
* **Primary Key**: `id UUID`
* **Columns**:
  * `event_id UUID`
  * `name TEXT`
  * `leader_id UUID`

## `notifications`
* **Purpose**: Core table for system-generated alerts delivered to users.
* **Primary Key**: `id UUID`
* **Columns**:
  * `user_id UUID`
  * `type TEXT` (Enum mapping)
  * `title TEXT`
  * `body TEXT`
  * `metadata JSONB`
  * `is_read BOOLEAN`

## `notification_preferences`
* **Purpose**: Stores user-level opt-in/opt-out configuration for different notification types.
* **Primary Key**: `user_id UUID`
* **Columns**:
  * `push_enabled BOOLEAN`
  * `event_reminders BOOLEAN`
  * `club_announcements BOOLEAN`
  * `attendance_alerts BOOLEAN`

## `announcements`
* **Purpose**: Global or Club-scoped broadcast messages.
* **Primary Key**: `id UUID`
* **Columns**:
  * `club_id UUID` (Nullable for global)
  * `title TEXT`
  * `content TEXT`
  * `author_id UUID`

## `leaderboard_scores`
* **Purpose**: Immutable ledger tracking all gamification points awarded to users.
* **Primary Key**: `id UUID`
* **Columns**:
  * `user_id UUID`
  * `club_id UUID`
  * `event_id UUID`
  * `points INTEGER`
  * `source_type TEXT`
  * `description TEXT`

## `audit_logs`
* **Purpose**: Centralized write-only immutable ledger for high-impact security and administrative events.
* **Primary Key**: `id UUID`
* **Columns**:
  * `action TEXT`
  * `actor_id UUID`
  * `target_id UUID`
  * `metadata JSONB`
  * `ip_address TEXT`
