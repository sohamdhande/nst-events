# Express Route Handler Catalog

## `POST /attendance/generate-qr`
* **Purpose**: Generates the live rotating TOTP payload for display on the organizer's screen during Operations Mode.
* **Trigger**: HTTP POST from authenticated Dashboard client.
* **Inputs**: `session_id`
* **Outputs**: Encrypted QR payload, expiry timestamp.
* **Dependencies**: Node.js `crypto` (generates `v1` payload per ADR-005; no external TOTP library required).
* **Security**: RBAC middleware enforces `CLUB_ADMIN` or `CORE_MEMBER` role before handler executes.

## `nst-worker` Deployment — `notificationWorker`
* **Purpose**: Polls the `native queue` notification queue and dispatches payloads to the Expo Push API.
* **Deployment**: Separate Kubernetes Deployment (`nst-worker`, 1 replica). **Not** part of the `nst-api` pod. See `docs/api/13-worker-deployment.md`.
* **Poll interval**: Every 5 seconds, batch of up to 100 messages.
* **Dependencies**: Prisma (PostgreSQL), Expo Push API, `EXPO_ACCESS_TOKEN` secret.
* **Security**: Runs with server-level database credentials. Not exposed as an HTTP endpoint. No ingress rule.

## `POST /admin/webhooks/slack`
* **Purpose**: Notifies the Faculty channel when a new event requires approval (`PENDING_APPROVAL`).
* **Trigger**: Called internally by the `approve_event` route handler after state transition.
* **Security**: Internal call; not client-accessible.

## `POST /admin/leaderboard/recalculate`
* **Purpose**: Triggers `REFRESH MATERIALIZED VIEW CONCURRENTLY` for both `student_leaderboard_mv` and `club_leaderboard_mv` to ensure the materialized views are up-to-date with the underlying `leaderboard_scores` ledger. It does NOT rebuild or mutate historical ledger rows. If a future full rebuild is desired, it will be documented as a completely separate administrative operation.
* **Trigger**: Manual HTTP POST by Platform Admin via Dashboard.
* **Security**: RBAC middleware enforces `PLATFORM_ADMIN` role.
