# NST-Events — Student Frontend Design System Reference

**Purpose:** This is the standing UI reference for all student-facing frontend work (web dashboard and mobile app). Any AI coding tool generating or editing student-facing UI in this codebase should follow this doc by default, without needing to be re-told these rules in every prompt. Screen-specific content/flows live elsewhere (see `nst-events-student-ux-spec.md`); this doc governs *how things look and behave visually*, consistently, everywhere.

If a specific task's instructions conflict with this doc, the task instructions win for that task only — but flag the conflict rather than silently deviating, since it may mean this doc needs updating.

---

## 1. Foundation

- **Design system: Material Design 3 (M3).** Use real M3 components (buttons, chips, cards, nav bars, dialogs, switches) from the platform's M3 component library (e.g. Material Web / MDC for web, Material Components for React Native / a compliant RN library for mobile) — do not hand-build custom look-alike components when an M3 equivalent exists.
- **Style variant: restrained/institutional, not "M3 Expressive."** This is a trust-focused daily-use tool for students and admins, not a consumer social app. Avoid the newer Expressive variant's bouncy shapes, exaggerated motion, and playful asymmetry. Keep shapes regular, motion subtle, layout disciplined.
- **Platforms:** Next.js web dashboard (desktop-first, responsive to tablet) and Expo React Native mobile app (Android-first, must remain acceptable on iOS). Apply the same underlying rules on both; adapt only where platform convention requires it (e.g. bottom nav on mobile vs. sidebar/top nav on web).
- **Theme tokens are external.** Do not invent a permanent brand palette. Use M3's dynamic color system generated from a single seed color as a placeholder (a muted blue or teal reads as institutional) until real brand tokens are supplied — but build everything to consume tokens/variables, not hardcoded hex values, so swapping the real theme later is a one-line change, not a re-design.

---

## 2. Color & Status System

- Use M3's **tonal color roles** (primary, secondary, tertiary, error, surface, surface-variant, and their "container"/"on-container" pairs) — do not introduce ad hoc colors outside this system.
- Generate the full tonal palette from **one seed color**, not multiple hand-picked hues. Semantic meaning comes from *which tonal role* is used, not from inventing new colors per state.
- **Status color mapping** (apply consistently everywhere a status appears — cards, pills, badges, banners):
  | Status | Tonal role |
  |---|---|
  | Registered / Success / Attendance marked | `primary` or a success-mapped tertiary, per whichever the seed palette resolves as the "positive" role — pick one and use it everywhere |
  | Waitlisted / Pending / Below-minimum warning | `secondary` or `tertiary` container (a "caution," not alarming, tone) |
  | Cancelled / Rejected / Error / Attendance failed | `error` / `error-container` |
  | Neutral / informational (e.g. "already checked in") | `surface-variant`, not `error` — idempotent/neutral outcomes must not look like failures |
- Never use color as the only signal for status — pair every status color with an icon and/or text label, for accessibility and because several statuses (waitlisted vs. below-minimum, for instance) can look similar in a quick glance otherwise.
- Dark mode: since M3 tonal palettes are built to support both light and dark automatically, ensure every screen is designed/tested in both — don't hardcode a light-only assumption anywhere (e.g. pure white backgrounds, pure black text).

---

## 3. Typography

- Use M3's **type scale roles** (Display, Headline, Title, Body, Label — each with Large/Medium/Small) applied by *role*, not by picking arbitrary font sizes. E.g. a screen title is always a Title role, a card's primary label is always Label or Title depending on hierarchy — stay consistent screen to screen.
- Placeholder typeface: **Roboto** (or M3's default) until real brand type tokens are supplied. Do not introduce a second display font for "personality" — this is a utility app, not editorial content.
- Line length and density: favor **information density** (smaller type scale roles, tighter spacing) on Home, Discover, and Leaderboard — screens checked quickly and often. Favor slightly more generous spacing on Event Detail and Club Profile, which are read more slowly and benefit from breathing room.

---

## 4. Component Usage Rules

Use the correct M3 component for the job — don't substitute a custom-styled generic `<div>`/`<View>` when a named M3 component exists for the pattern:

| UI need | M3 component |
|---|---|
| Discover ↔ Leaderboard toggle, Upcoming ↔ Past toggle | **Segmented button** |
| EventType filtering, "My Clubs" filter | **Filter chip** (horizontally scrollable row) |
| Role badges (Member/Core Member/Club Admin), status labels | **Assist chip** or a compact badge — pick one pattern and reuse it everywhere roles/status appear |
| Event cards, leaderboard rows, home feed action items | **Card** (pick either elevated or outlined variant as the one standard — do not mix both variants for the same kind of content across different screens) |
| Register, Confirm, Scan (primary commitments) | **Filled button** |
| View Details, secondary navigation actions | **Outlined button** |
| Dismiss, Skip, low-emphasis actions | **Text button** |
| Register confirmation, Leave Team, Transfer Leadership, Log Out | **Dialog** (M3 basic dialog) — any action with real consequence gets a dialog, not an inline toggle |
| Ephemeral QR scan flow | **Full-screen dialog** pattern, not a small modal — this is a focused task that deserves the whole screen |
| Notification Preferences toggles | **Switch**, one per preference, flat list — never grouped under a single master switch that implies hierarchy that doesn't exist in the data |
| Bottom navigation (mobile) | **Navigation bar**, exactly 3 destinations (Home, Campus, Profile) — never more, never fewer, per the confirmed IA |
| Sidebar/top nav (web) | Equivalent persistent global nav shell reflecting the same 3 sections |
| Elevated content (scan modal, bottom sheets, dialogs) | **Elevation/surface tonal levels**, never a hand-drawn `box-shadow`/drop shadow — use M3's elevation system so it responds correctly to light/dark mode |
| Empty states | Centered icon + short text + (if applicable) one primary action — no dense illustration-heavy empty states; keep it plain and fast to parse |

---

## 5. Spacing, Shape, and Layout

- Use a consistent spacing scale (e.g. 4dp/px base unit, multiples of 4 or 8) throughout — don't introduce arbitrary one-off spacing values per screen.
- **Corner radius: restrained end of M3's range.** Small-to-medium rounding on cards, buttons, and chips. Avoid the very rounded, "pill-everything" extreme associated with M3 Expressive — this should read as clean and institutional, not playful.
- Touch targets: **minimum 48dp** on mobile for any tappable element, without exception — this app is used quickly, often one-handed, sometimes while walking toward a scan window that's about to expire.
- Grid/layout: web dashboard should use a clear column grid (sidebar/nav + main content, with sensible max-width on wide screens so content doesn't stretch edge-to-edge on large monitors). Mobile should be single-column, full-width, with consistent horizontal padding.

---

## 6. Motion

- Keep motion **functional, not decorative**: use it to communicate state changes (a card transitioning from "queued offline" to "confirmed," a dialog appearing/dismissing, a chip filter applying) — not for flourish.
- Standard M3 easing/duration curves; nothing bouncy, elastic, or exaggerated (that's Expressive territory, which this app should avoid).
- The QR scan flow's transitions between states (validating → success/failure) should feel immediate and confident — no gratuitous delay or animation dragging out a moment that's meant to reduce anxiety, not build suspense.

---

## 7. Friction Model — where to add it, where to remove it

This governs interaction design as much as visuals, and it's a recurring product principle worth stating explicitly:

- **Add deliberate friction (a confirmation dialog, a clear warning tone) for:** registering for an event, cancelling a registration, joining/leaving a team, transferring team leadership, removing a team member, logging out, filing a dispute. These are commitments or consequential actions — the UI should never let them happen from a single accidental tap.
- **Keep frictionless for:** browsing Discover, applying filters, viewing a leaderboard, viewing a club profile, viewing notifications. Passive/exploratory actions should never require a confirm step or extra tap.
- **Never show an optimistic/instant success state before the server confirms.** This applies to registration and to QR scan validation. Always show a brief, honest pending/loading moment. This is a hard product rule (optimistic UI was explicitly evaluated and rejected for this platform), not a stylistic preference — do not "improve perceived speed" by faking a checkmark early.

---

## 8. Status & Error Copy Tone

- **Neutral outcomes read as neutral, not as errors.** E.g. "Already checked in at [time]" is informational, not a failure state — don't style it in `error` red or use an alarming icon.
- **Security-sensitive failures use identical, non-revealing copy.** Geofence failure and location-spoofing detection must show the exact same student-facing message ("We couldn't verify your location for this event") and identical visual treatment — the backend distinguishes them; the UI never should. Do not add fields, icons, or details that would let someone infer which specific check failed.
- **Recoverable failures always offer a next step**, not a dead end. Expired QR code → immediately re-prompt the camera. Location verification failed → offer a retry and, if applicable, a path to file a dispute. Never leave the student on a screen with only a generic error and no way forward.
- **Ineligibility is explained, not hidden.** If a student can't register for an event, show why (a visible eligibility notice), rather than simply omitting or disabling the button with no explanation.

---

## 9. Accessibility Minimums

- Every status must be conveyed by more than color alone (icon + text label).
- Minimum 48dp touch targets on mobile (see Section 5).
- Sufficient contrast in both light and dark mode — verify against M3's tonal contrast guidance, don't eyeball it.
- All interactive elements need visible focus states on web (keyboard navigation must work, not just mouse/touch).
- Camera/QR scan screen needs a non-visual fallback path described in-flow if camera access is denied (e.g. clear instructional text, not a silent blank camera view).

---

## 10. Explicit Don'ts

- Don't invent custom components when an M3 component already covers the pattern.
- Don't mix card variants (elevated vs. outlined) for the same content type across different screens.
- Don't use drop shadows — use M3 elevation/surface tonal levels.
- Don't hardcode colors, spacing, or type sizes as literal values where a token/role should be used instead.
- Don't use M3 Expressive shapes, motion, or asymmetry.
- Don't design an idle/empty state for the QR scanner — it is an ephemeral modal that only exists during an active attendance window; there is no "browse the scanner" screen.
- Don't design an avatar/photo upload affordance — avatars are generated from initials (or pulled from Google), never uploaded by the student in V1.
- Don't design a "follow a club" affordance separate from membership — club membership is binary and admin-granted only.

---

## 11. Reference

Screen-by-screen content, flows, and state definitions live in the companion UX/IA spec (`nst-events-student-ux-spec.md`). This document should be read alongside that one — this doc answers "how should it look and behave," the other answers "what screens exist and what do they contain."
