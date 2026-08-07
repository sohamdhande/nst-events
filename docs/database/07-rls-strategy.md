# RLS Strategy

## Authentication Model
The platform uses Google OAuth 2.0 via Express. After OAuth, the Express backend issues a JWT. On each request, the Express RBAC middleware verifies the JWT and sets `current_setting('app.user_id')` via a Prisma middleware before any query executes.

## Hybrid RBAC & JWT Roles
We rely on contextual role resolution via queries inside the RLS policy. Example using the `current_user_id()` helper (see `docs/security/01-rls-architecture.md`):
```sql
current_user_id() IN (SELECT user_id FROM club_memberships WHERE role = 'CLUB_ADMIN')
```

## RLS Principles
1. Default Deny All.
2. Read access is broad (Public data).
3. Write access is extremely strict and contextual.

## Example Policy Matrices

### `events`
* **Who can read**: Anyone (If `state = PUBLISHED`), Organizers (If `DRAFT` or `PENDING_APPROVAL`).
* **Who can write (INSERT)**: `CLUB_ADMIN`, `CORE_MEMBER` (Defaults to `DRAFT`).
* **Who can update**: `CLUB_ADMIN` (while Draft). `FACULTY_MENTOR` (to push to `PUBLISHED`).
* **Who can delete**: Soft-delete only by `CLUB_ADMIN`.

### `attendance_records`
* **Who can read**: Self (Student), Organizers (Event owners).
* **Who can write**: Self (If passing geofence and dynamic QR validation).
* **Who can update**: `PLATFORM_ADMIN` only. (Faculty cannot override via UI).
* **Who can delete**: `PLATFORM_ADMIN` only.
