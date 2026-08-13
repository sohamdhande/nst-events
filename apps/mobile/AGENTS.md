# Mobile App - Agent Instructions

> **IMPORTANT**: Please read the root [AGENTS.md](file:///Users/sohamdhande/Docs_Local/nst-events/AGENTS.md) first.

## Stack Notes
- **Framework**: Expo, Expo Router
- **State/Data**: Zustand, React Query
- **Authentication**: Expo SecureStore for tokens. Logout must clear both SecureStore auth state and the full React Query cache — a cross-session cache leak was previously found and fixed here; do not regress it.

## Read before any screen work
- [docs/frontend/mobile/IMPLEMENTATION_CONTRACT.md](file:///Users/sohamdhande/Docs_Local/nst-events-docs/docs/frontend/mobile/IMPLEMENTATION_CONTRACT.md)
- [docs/frontend/mobile/SCREEN_INDEX.md](file:///Users/sohamdhande/Docs_Local/nst-events-docs/docs/frontend/mobile/SCREEN_INDEX.md)
- The relevant individual screen spec in `docs/frontend/mobile/<screen>.md` for whatever is being worked on.
- [docs/frontend/shared/API_DEPENDENCY_MATRIX.md](file:///Users/sohamdhande/Docs_Local/nst-events-docs/docs/frontend/shared/API_DEPENDENCY_MATRIX.md) — verify every API call against this before writing it.

## Commands
Run these commands from the `apps/mobile` directory:
- **Install**: `npm install`
- **Start**: `npm run start`
- **Typecheck**: `npm run typecheck`
- **Lint**: *(No lint script is currently configured in package.json)*
- **Test**: `npx vitest` (from devDependencies)

## Build Order
1. Expo Router shell
2. Auth/SecureStore
3. React Query
4. Cache isolation
5. Nav shell
6. Screens (in `SCREEN_INDEX.md` order)
