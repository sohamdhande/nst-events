# NST Events - Agent Instructions

NST Events is a monorepo consisting of `apps/api` (a frozen Express backend), `apps/dashboard` (a Next.js web application), `apps/mobile` (an Expo React Native application), `packages/database` (a frozen Prisma and PostgreSQL setup), `packages/shared`, and `packages/config`.

## Non-negotiable boundaries
- NEVER modify `apps/api`, `apps/worker`, `packages/database`, Prisma schema, or migrations.
- NEVER invent an API route, response field, or enum value.
- NEVER trust frontend role checks as authorization — backend RBAC/RLS is authoritative.
- NEVER persist access tokens in localStorage.
- The `nst-events-docs` repo is the single source of truth. When two docs conflict, STOP and report the conflict with file:line citations — do not silently pick one.
- When something is unspecified: STOP and report "SPECIFICATION GAP" — do not guess.

## Read before any task
Please read these documents before starting work:
1. [docs/frontend/IMPLEMENTATION_CONTRACT.md](file:///Users/sohamdhande/Docs_Local/nst-events-docs/docs/frontend/IMPLEMENTATION_CONTRACT.md)
2. [docs/frontend/AI_BUILD_RULES.md](file:///Users/sohamdhande/Docs_Local/nst-events-docs/docs/frontend/AI_BUILD_RULES.md)
3. [docs/frontend/shared/DATA_CONTRACT.md](file:///Users/sohamdhande/Docs_Local/nst-events-docs/docs/frontend/shared/DATA_CONTRACT.md)
4. [docs/api/02-api-routing-matrix.md](file:///Users/sohamdhande/Docs_Local/nst-events-docs/docs/api/02-api-routing-matrix.md)

## Critical data-shape warning
This backend returns DIFFERENT field casing for the same logical resource depending on which endpoint is called (e.g. `GET /clubs` returns `bannerUrl` camelCase, `GET /clubs/:id` returns `banner_url` snake_case — confirmed via Phase 22C ground-truth audit against actual service code). Never share a TypeScript type between list and detail endpoints for: Event, Club, User, Registration. Always pull the exact field list for the SPECIFIC endpoint from `DATA_CONTRACT.md`.

## Deferred — do not build clients for these
- `/v1/home/feed`
- `/v1/events/:id/waitlist`
- `/v1/admin/points/adjust`
- `/v1/analytics/*`
- `/v1/announcements`
