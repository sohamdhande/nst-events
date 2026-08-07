# API Freeze V1

## Status: FROZEN
## Version: 1.0
## Date: 2026-06-05

## Accepted Risks
* RLS policies and RPCs place a heavy computation load on the database.
* Express REST API calls mean the database schema is closely tied to the frontend data models.

## Known Limitations
* Rate limiting is currently global per IP/User; advanced behavioral rate limiting is not implemented.

## Future Improvements
* Advanced cursor pagination with filtered aggregates.
* PostgreSQL-level query caching via `pg_stat_statements` tuning for public event feeds.

> **Historical Architecture Reference**: Earlier versions mentioned GraphQL (via pg_graphql) and Redis as future improvements. These were evaluated and rejected — the approved stack uses REST exclusively and relies on PostgreSQL query optimization rather than external caching layers.

## Not In Scope
* Cryptographic signing of API requests from the mobile client.

## Resolved Issues (Phase 1-4)
* All 11 missing RPCs (disputes, handovers, lock/unlock, etc.) have been added to the catalog.
* Event archiving access has been expanded to include Faculty roles.

## Resolved Issues (Post-Audit Freeze Pass — 2026-06-09)
* `register_event` RPC now explicitly documents lock-free atomic increment pattern (`UPDATE ... WHERE registration_count < max_capacity RETURNING registration_count`) with `max_capacity` and `registration_count` fields.
* `approve_leadership_transfer` and `reject_leadership_transfer` RPCs now include `FACULTY_ADMIN` as a fallback caller.
* Audit trigger actor identity resolution documented: triggers use `current_user_id()` from `app.user_id` session variable.

## Previously Open Items — Now RESOLVED

The following items appeared in earlier versions of this freeze document as open. They are **fully specified** in the current documentation and are **in scope for V1**.

| Item | Resolution | Authoritative Location |
|---|---|---|
| Notifications feature | ✅ RESOLVED — Full inbox, preferences, and read/unread endpoints specified | `docs/backend/04-api-contract-freeze.md` §Notification Endpoints; `docs/api/09-notification-architecture.md` |
| Search feature | ✅ RESOLVED — `GET /search` endpoint with FTS and type filtering specified | `docs/backend/04-api-contract-freeze.md` §Search Endpoint |
| Leave team | ✅ RESOLVED — `DELETE /teams/:id/leave` and `leave_team` RPC specified | `docs/backend/04-api-contract-freeze.md` §Registration Endpoints; `docs/api/05-rpc-catalog.md` |
| Create club | ✅ RESOLVED — `POST /clubs` endpoint with Platform Admin role specified; `create_club` RPC documented | `docs/backend/04-api-contract-freeze.md` §Club Endpoints |

## Remaining Open Items (Requires Human Decision)

| Item | Status | Blocking |
|---|---|---|
| Database Hosting Provider | Under Review | Non-blocking — any PostgreSQL host is compatible with Prisma |
| CSRF protection behaviour on mobile | Needs Decision | Blocking for T-117 only — see `docs/backend/01-implementation-roadmap.md` §Phase 10 |

