# Express API Routing Guidelines

## Architecture Principle
All client requests go to the Express backend. There are no "direct queries" — the concept of a client querying the database directly no longer exists. Express is the only entry point into the data layer.

## When to Use a Simple Express Route Handler
Standard route handlers with a straightforward Prisma query are appropriate for operations that require no complex transactional logic or external calls.

**Examples:**
* `GET /events` — fetch published events (Prisma `findMany` with RLS via session variable)
* `GET /clubs` — club listing and discovery
* `GET /leaderboard` — individual and club leaderboard reads
* `GET /users/me` — fetch authenticated user's own profile and club memberships
* `GET /notifications` — fetch personal unread notifications
* `PATCH /users/me` — update user profile display name

## When to Call a PostgreSQL RPC from Express
Operations that require atomic state changes, capacity validation, or complex multi-table transactions must invoke a PostgreSQL stored procedure via Prisma's `$queryRaw` / `$executeRaw`, not a plain Prisma model call.

**Examples of operations that MUST use RPCs (called server-side by Express):**
* **`register_event`**: Requires lock-free atomic capacity update. A plain Prisma insert would bypass capacity guarantees.
* **`mark_attendance`**: Requires atomic TOTP validation (per ADR-005), geofence check, device collision detection, and record write. Must be an RPC.
* **`approve_event`**: Triggers state machine transitions with audit logging. Must be atomic.
* **`delete_club_membership`**: Can orphan teams or events. Requires transactional cleanup logic.

## Key Distinction
In both cases above, the **client always talks to Express**. The difference is only in what Express does internally — whether it runs a simple Prisma query or calls a PostgreSQL stored procedure. This is an internal implementation detail invisible to the client.
