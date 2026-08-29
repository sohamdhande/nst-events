# NST Events - Agent Instructions

NST Events is a monorepo consisting of `apps/api` (a frozen Express backend), `apps/dashboard` (a Next.js web application), `apps/mobile` (an Expo React Native application), `packages/database` (a frozen Prisma and PostgreSQL setup), `packages/shared`, and `packages/config`.

## Non-negotiable boundaries
- NEVER modify `apps/api`, `apps/worker`, `packages/database`, Prisma schema, or migrations.
- NEVER invent an API route, response field, or enum value.
- NEVER trust frontend role checks as authorization — backend RBAC/RLS is authoritative.
- NEVER persist access tokens in localStorage.
- The `nst-events-docs` repo is the single source of truth. When two docs conflict, STOP and report the conflict with file:line citations — do not silently pick one.
- When something is unspecified: STOP and report "SPECIFICATION GAP" — do not guess.
- For all student-facing frontend UI work, follow nst-events-student-design-system.md for visual/interaction rules and nst-events-student-ux-spec.md for screen content and flows. Do not deviate from the design system doc without flagging the conflict.

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

---

## How to work: general operating principles

Everything above this line is project law and always wins if anything below
seems to conflict with it. The principles below describe *how* to carry out
work inside those boundaries — thoroughly and completely, not superficially.

### 1. Investigate before you touch anything

Before editing any file in `apps/dashboard`, `apps/mobile`, `packages/shared`,
or `packages/config`:

- Read the relevant files fully, not just the function you think is
  relevant — context lives in imports, callers, tests, and config.
- Search the codebase for related usages and existing conventions (naming,
  error handling, folder structure, existing hooks/utilities) so new code
  matches what's already there.
- Check for existing tests covering the area you're about to touch.
- For anything touching an API response shape, go read `DATA_CONTRACT.md`
  for that *specific* endpoint — never infer the shape from a similar
  endpoint or from memory of a previous task.
- If a bug is reported, reproduce it first. Don't fix what you haven't
  confirmed is actually broken.

### 2. Form a real plan before you start editing

- Write out the concrete steps for non-trivial tasks before touching code.
- Identify what else the change could affect (other components consuming
  the same type, shared utilities, tests) and check those too.
- Choose the smallest correct change that solves the actual problem, not a
  hack that hides the symptom.

### 3. Do the whole task, not a demo of it

- Implement completely — no stub functions, no `TODO` placeholders, no
  "left as an exercise," unless the user explicitly asked for a skeleton.
- Handle edge cases and error/empty/loading states, not just the happy path.
- Update everything a change touches: related types, tests, callers, and
  any docs in this repo that describe the changed behavior.
- If a task is too large for one pass, say so up front and be explicit
  about what's included now vs. deferred — don't quietly under-deliver.

### 4. Never fake success

- Never hardcode a value or mock a result just to make a test or a screen
  "look right" without the underlying logic actually working.
- Never invent a field, route, or enum value to fill a gap — that's exactly
  what the non-negotiable boundaries above prohibit. If the data contract
  doesn't specify something you need, that's a SPECIFICATION GAP: stop and
  report it, don't paper over it with a guess.

### 5. Verify your own work

- Run the relevant tests, linter, and type-checker after making changes.
- Actually exercise the code path you changed where feasible.
- If a test or build fails, find the real root cause — don't loosen a type,
  widen an assertion, or swallow an error just to get green.
- Only report a task as complete when it's actually complete.

### 6. Debugging discipline

- Reproduce the exact failure first.
- Form a hypothesis, check it against the code, then fix the root cause —
  don't trial-and-error random changes.
- After fixing, re-run the original failing case plus a broader check that
  nothing else regressed.

### 7. Handling ambiguity — deference to project rules

- This project's own rule is authoritative: when something is unspecified,
  STOP and report "SPECIFICATION GAP" rather than guessing. Do not apply a
  generic "pick a reasonable default and proceed" approach here — that only
  applies to genuinely cosmetic, non-contractual details (e.g. spacing,
  minor copy wording) where no data contract or routing matrix is at stake.
- Similarly, if two docs in `nst-events-docs` conflict, stop and report the
  conflict with file:line citations rather than silently picking one.

### 8. Respect the existing codebase

- Match existing code style, naming conventions, and architectural
  patterns already used in `apps/dashboard` / `apps/mobile`.
- Don't refactor unrelated code "while you're in there" unless asked.
- Reuse existing shared utilities in `packages/shared` instead of
  reinventing them.
- If you notice something clearly broken or risky nearby that's out of
  scope, mention it in your summary rather than silently fixing or
  ignoring it.

### 9. Communication

- Keep progress updates concise and concrete: what you read, what you
  changed, what you verified.
- When done, summarize: what changed, why, what was tested, any
  SPECIFICATION GAPs or doc conflicts surfaced, and anything left open.
- Don't claim something is "done" or "fixed" unless you've verified it.

### 10. Persistence within bounds

- Don't give up after one failed attempt — try a different angle or gather
  more information from the docs before concluding something is blocked.
- If genuinely blocked (missing spec, conflicting docs, a frozen package
  that would need to change), say exactly what's blocking you rather than
  working around the boundary.

---

## Non-negotiables (recap)

- No fabricated data, fake test results, or invented API behavior.
- No silent scope-narrowing — say what's deferred.
- No destructive actions without explicit confirmation.
- No leaving the repo in a broken state (failing build/tests) without
  clearly flagging it.
- No touching `apps/api`, `apps/worker`, `packages/database`, or the Prisma
  schema/migrations, ever.
- Always give a very detailed implementation plan