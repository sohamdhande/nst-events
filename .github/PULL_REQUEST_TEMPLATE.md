## Summary

<!-- Briefly describe the changes introduced by this PR (1–3 sentences). -->

## Phase & Related Documentation

<!-- Link the relevant phase or design doc from docs repo, e.g. docs/backend/03-prisma-schema-plan.md -->

## Type of Change

- [ ] `feat` - New feature
- [ ] `fix` - Bug fix
- [ ] `chore` - Maintenance / tooling / dependency update
- [ ] `docs` - Documentation update
- [ ] `refactor` - Code refactoring without behavior change
- [ ] `test` - Test additions or improvements

## Verification & Testing

- [ ] `pnpm typecheck` passed cleanly
- [ ] `pnpm lint` passed cleanly
- [ ] `pnpm test` passed cleanly
- [ ] Database schema validated (`pnpm prisma validate`)
- [ ] Verified against local `docker compose` environment

## PR Checklist

- [ ] Scoped to single app/package or single phase module
- [ ] No direct `SELECT FOR UPDATE` introduced for capacity logic (see `docs/database/19-scalability-review.md`)
- [ ] Roles adhere to two-tier `GlobalRole` / `ClubRole` separation
- [ ] Any doc ambiguities flagged and noted above
