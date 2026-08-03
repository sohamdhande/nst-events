# Contributing to NST-Events

This document defines how we branch, commit, and merge code. Read this before your first PR.

Architecture and product decisions live in the companion **[NST-Events Docs](https://github.com/sohamdhande/nst-events-docs)** repo (`MASTER_CONTEXT.md`, `docs/`, `adrs/`). This file only covers day-to-day git workflow.

## Before You Start Coding

1. Confirm which **phase** your task belongs to (see `docs/backend/05-development-order.md` in the docs repo). Don't start work that depends on a phase that hasn't merged yet.
2. Read the relevant doc(s) for your task fully before writing code. If something in the doc is ambiguous or seems to contradict another doc, **flag it before you guess** — ping the team, don't silently pick an interpretation.
3. Make sure your local environment is current: pull `main`, run `pnpm install`, confirm `docker compose up` and `pnpm run typecheck` pass clean before branching.

## Branching

We use one long-lived branch: `main`. Everything else is a short-lived feature branch merged via PR.

### Branch naming

```
<type>/<scope>-<short-description>
```

- **type**: `feat`, `fix`, `chore`, `docs`, `test`, `refactor`
- **scope**: the app or package you're touching — `api`, `worker`, `mobile`, `dashboard`, `db`, `shared`

**Examples:**
```
feat/db-phase1-schema
feat/api-auth-google-oauth
feat/api-registration-capacity-lock
feat/mobile-qr-scanner
feat/dashboard-approval-workflow
fix/api-attendance-totp-window
chore/repo-ci-pipeline
docs/db-schema-notes
```

Keep it short and specific enough that someone can guess what the branch does without opening it.

### Creating a branch

```bash
git checkout main
git pull origin main
git checkout -b feat/api-auth-google-oauth
```

Never branch off another feature branch unless you've explicitly agreed to stack work with someone — branch from `main`.

## Commits

Use [Conventional Commits](https://www.conventionalcommits.org/) style:

```
<type>(<scope>): <short summary>

<optional body — why, not just what>
```

**Examples:**
```
feat(db): add users, clubs, club_memberships tables

feat(api): implement register_event RPC with atomic capacity increment

Uses lock-free UPDATE...RETURNING pattern per docs/database/19-scalability-review.md,
not SELECT FOR UPDATE, to avoid lock contention at 500+ concurrent registrations.

fix(api): correct TOTP window validation to 15 seconds
```

Keep commits small and focused — one logical change per commit. Don't bundle unrelated fixes into a schema PR.

## Opening a Pull Request

1. Push your branch and open a PR against `main`.
2. **PR title**: same convention as commits — `feat(db): Phase 1 schema and migrations`
3. **PR description must include:**
   - What this PR does (1–3 sentences)
   - Which phase/doc section this implements (link the doc file, e.g. `docs/backend/03-prisma-schema-plan.md`)
   - Anything you found ambiguous in the docs and how you resolved it
   - How you tested it (commands run, what you verified manually)
4. Keep PRs scoped to one phase or one module. A Phase 1 schema PR should not also touch `apps/api` routes — if you notice unrelated issues while working, open a separate PR or note them as a follow-up instead of scope-creeping the current one.

### PR checklist (put this in the PR description, check off what applies)

- [ ] `pnpm run typecheck` passes
- [ ] `pnpm run lint` passes
- [ ] `pnpm run test` passes (if tests exist for this area yet)
- [ ] Verified against local `docker compose` environment, not just "it compiles"
- [ ] No `SELECT FOR UPDATE` introduced for capacity/concurrency logic (see `docs/database/19-scalability-review.md`) unless explicitly discussed
- [ ] Role checks use the two-tier `global_role` / `club_role` model, not a flat hierarchy
- [ ] Didn't touch files outside my assigned app/package without flagging it in the PR description

## Review

- **Every PR needs at least one review before merge** — no self-merging, even for small changes.
- **These areas require review from [project lead / senior backend], not just any teammate**, because they're security- or concurrency-critical and have already produced real bugs once:
  - Event registration capacity locking (Phase 5)
  - Attendance TOTP / HMAC / geofence validation (Phase 6)
  - RLS policies and RBAC middleware (Phase 3, Phase 10)
  - JWT / OAuth / refresh token logic (Phase 2)
- Reviewers: check the PR against the referenced doc, not just "does the code look reasonable." If the PR claims to implement `docs/database/12-registration-data-model.md`, actually open that doc and compare.
- If you disagree with feedback, discuss it in the PR thread — don't just force-push around it.

## Merging

- Squash merge into `main` once approved. Keep the squashed commit message clean (conventional commit format).
- Delete the branch after merge.
- If your PR unblocks other people's work (e.g. Phase 1 schema unblocking Phase 2 auth), say so explicitly in the PR and ping them once merged — don't assume they're watching `main`.

## When You Find a Doc Contradiction

This has already happened twice (capacity locking, role hierarchy) and will happen again as the docs evolve. If you find one:

1. Don't silently pick a side and code against it.
2. Flag it to the project lead before merging anything that depends on the ambiguous part.
3. Once resolved, the doc fix should land as its own small PR/commit in the docs repo — reference it from your code PR.

## Questions

If a doc doesn't answer your question and no one on the team knows either, that's a sign it needs to become a decision — raise it, don't guess and move on.
