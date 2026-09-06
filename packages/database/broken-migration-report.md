# Historical Migration Defect: `20260827212000_hotfix_academic_enum`

**Commit Date:** 2026-08-29 20:55:18 +0530
**Author:** sohamdhande
**Commit Hash:** `04ee88f917dbfe352afb31d61f04d586b2ba05e6`
**Status:** Merged into `main` branch (predates the current feature branch)

## The Defect
The file `packages/database/prisma/migrations/20260827212000_hotfix_academic_enum/migration.sql` contains the following lines:

```sql
-- Line 2
ALTER TYPE "AssignmentSource" ADD VALUE IF NOT EXISTS 'INSTITUTIONAL_EMAIL_INFERENCE';

-- ...

-- Line 11
UPDATE "user_academic_profiles" SET "assignment_source" = 'INSTITUTIONAL_EMAIL_INFERENCE' WHERE "assignment_source"::text = 'EMAIL_INFERENCE';
```

### Why this is a global blocker
Postgres enforces a strict transactional boundary on ENUM alterations: **"New enum values must be committed before they can be used."** 

Because Prisma automatically wraps the execution of every `migration.sql` file in a single, atomic `BEGIN ... COMMIT` block, this migration attempts to use the newly created `INSTITUTIONAL_EMAIL_INFERENCE` enum value in the `UPDATE` statement before the `ALTER TYPE` transaction has committed.

When running `npx prisma migrate deploy` or `reset` from scratch on a clean database, this migration crashes unconditionally with Postgres error `55P04: unsafe use of new value "INSTITUTIONAL_EMAIL_INFERENCE" of enum type "AssignmentSource"`. 

This is a globally broken migration that will prevent any developer (or CI system) from successfully running `prisma migrate dev` or `reset` against a fresh Postgres instance.

### Resolution used in this session
To unblock development on this branch without rewriting historical migrations (which is prohibited), I explicitly bypassed the failed migration using Prisma's resolution command against my local database:
```bash
npx prisma migrate resolve --applied 20260827212000_hotfix_academic_enum
```
(I also similarly resolved `20260828120000_error02_repository_sqlstate` which exhibited a similar defect trying to redundantly recreate an existing policy).
