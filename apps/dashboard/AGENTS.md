# Dashboard Web App - Agent Instructions

> **IMPORTANT**: Please read the root [AGENTS.md](file:///Users/sohamdhande/Docs_Local/nst-events/AGENTS.md) first.

## Stack Notes
- **Framework**: Next.js App Router
- **Data Fetching**: React Query
- **Authentication**: In-memory access token, HttpOnly refresh-token cookie. Extend `lib/api.ts` and `lib/auth-store.ts` if they exist — never create a second auth system.

## Read before any screen work
- [docs/frontend/web/IMPLEMENTATION_CONTRACT.md](file:///Users/sohamdhande/Docs_Local/nst-events-docs/docs/frontend/web/IMPLEMENTATION_CONTRACT.md)
- [docs/frontend/web/SCREEN_INDEX.md](file:///Users/sohamdhande/Docs_Local/nst-events-docs/docs/frontend/web/SCREEN_INDEX.md)
- The individual screen spec in `docs/frontend/web/<screen>.md` for whatever is being worked on.
- [docs/frontend/shared/API_DEPENDENCY_MATRIX.md](file:///Users/sohamdhande/Docs_Local/nst-events-docs/docs/frontend/shared/API_DEPENDENCY_MATRIX.md) — verify every API call against this before writing it.

## Commands
Run these commands from the `apps/dashboard` directory:
- **Install**: `npm install`
- **Dev**: `npm run dev`
- **Build**: `npm run build`
- **Typecheck**: `npm run typecheck`
- **Lint**: `npm run lint`
- **Test**: `npx vitest` (from devDependencies)

## Build Order
1. App shell
2. Auth/session
3. API client
4. React Query provider
5. Error boundary
6. Loading primitives
7. Screens (in the order listed in `SCREEN_INDEX.md`)
