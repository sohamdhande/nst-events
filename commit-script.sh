#!/bin/bash
set -e

# Commit 1
git add packages/database/prisma/migrations/20260805112600_phase3_rbac_rls
git add packages/database/prisma/migrations/20260805151500_phase3_hotfix_users_rls
git commit -m "feat(database): add nst_app role, RLS policies, and audit trigger for Phase 3

- Create least-privilege nst_app Postgres role (no password; set out-of-band per environment)
- Add current_user_id() helper function
- Enable RLS on users, clubs, club_memberships
- Add scoped RLS policies for all three tables with SECURITY DEFINER helpers
  (is_active_club_member, has_club_role) to prevent infinite recursion
- Add audit trigger on club_memberships
- Fix audit trigger entity_id cast (UUID directly, not ::text)
- Remove ghost migration 20260805055322 from filesystem and _prisma_migrations"

# Commit 2
git add apps/api/src/
git add packages/database/src/client.ts
git add .gitignore
git commit -m "feat(api): implement Phase 3 RBAC middleware, users module, and clubs module

- authorize.ts: requireRole and requireClubRole with live DB resolution via withUserContext
- authenticate.ts: wrap user lookup in withUserContext (required after RLS enabled on users table)
- client.ts: explicitly pass DATABASE_URL in PrismaClient constructor to enforce runtime env
- users module: GET /me, PATCH /me, GET /:id/profile
- clubs module: full CRUD, atomic create_club transaction, membership add/update/remove,
  FTS search via plainto_tsquery
- addMember: catch RLS 42501 denial and surface as ForbiddenError (not raw 500)
- updateClubStatus: catch P2025 on RLS-silenced UPDATE and return null -> 404"

# Commit 3
cd docs/
git add backend/04-api-contract-freeze.md security/01-rls-architecture.md
git commit -m "docs: update docs to reflect Phase 3 implementation and verified behavior

- 04-api-contract-freeze.md: GET /clubs/:id members array is conditional on membership
- 01-rls-architecture.md: update withUserContext import path (from @nst/database, not lib/db.ts)
- Document verified RLS denial behavior: UPDATE -> silent 0 rows, INSERT -> 42501 (not P2004)"
cd ..

