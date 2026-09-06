# NST-Events — Student App UX/IA Spec (V1) — v2

Scope: student-facing surfaces only (mobile app, Expo React Native). This version replaces the v1 draft, which contained unverified structural assumptions. Everything below is grounded in `nst-events-docs`, the Prisma schema, and service-layer behavior, as reported in engineering's spec-gap review. Items still undefined in the docs are marked **SPECIFICATION GAP** — not invented, not guessed. Decisions made by the product owner directly (this conversation) are marked **DECIDED**.

Visual theme (color, type, tokens) is out of scope — external design system, applied later in Stitch.

---

## 1. Information Architecture (corrected)

### 1.1 Navigation shell

**3-tab structure**, per `docs/mobile/01-mobile-navigation.md` — not 5.

| Tab | Purpose | Notes |
|---|---|---|
| **Home** | Context-aware feed of immediate actions | Powered by `get_home_feed`. Not a generic event list — surfaces what the student needs to act on right now (live attendance windows, pending team invites, onboarding checklist for new users). |
| **Campus** | Shared community resources, all published events | Contains Discover (general feed of all `PUBLISHED` events) and Club Profiles. |
| **Profile** | Identity, clubs, settings | |

**Scan is not a tab.** Per `docs/mobile/05-home-screen-architecture.md`, the QR scanner is an **ephemeral modal**, conditionally elevated to the top of the Home feed only when an attendance window is currently active. It does not exist as a persistent nav destination and has no idle state to design — if there's no live window, there is nothing to show.

**Notifications: DECIDED.** Bell icon, top header of the Home tab. (Placement itself was a spec gap; product has now resolved it.)

### 1.2 Full screen inventory

```
Auth
 ├─ Splash
 ├─ Login (Google OAuth)
 ├─ Domain-rejected error state [SPECIFICATION GAP: no support/contact path defined in docs]
 └─ Onboarding flow (triggered from a checklist on Home, for empty/new profiles — docs/mobile/04-user-flows.md)

Home (Tab 1)
 ├─ Home Feed (context-aware: live attendance windows, pending actions, onboarding checklist)
 ├─ [Ephemeral] QR Scan Modal (elevated only during active attendance window)
 │   ├─ Camera / Scan View
 │   ├─ Validating
 │   ├─ Success
 │   └─ Failure states (expired code, geofence fail, spoofing detected, already marked)
 └─ Notification Center (via bell icon, top header)

Campus (Tab 2)
 ├─ Discover Feed (general feed of all PUBLISHED events) [SPECIFICATION GAP: no sub-tab structure (My Clubs vs All) defined — treat as single feed with EventType filter until specified]
 ├─ Filter by EventType (enum: WORKSHOP, COMPETITION, GUEST_SPEAKER, etc. — confirm full enum list from schema before building filter UI)
 ├─ Event Detail
 │   ├─ Solo registration flow (with confirm dialog — DECIDED)
 │   ├─ Team registration flow (create team, invite by user search, view below-minimum warning)
 │   ├─ Waitlist state
 │   └─ Registration confirmation
 └─ Club Profile (bio, roster context, all events hosted by that club — no "follow without membership" concept; membership is binary)

Profile (Tab 3)
 ├─ Profile Home (fullName, email, avatarUrl from Google; academic profile: Semester, Program, Batch)
 ├─ My Clubs (club_memberships list, each showing actual role: MEMBER / CORE_MEMBER / CLUB_ADMIN)
 ├─ My Events (Upcoming / Past — schema-backed, includes team status and attendance status per event)
 ├─ Notification Preferences (granular: pushEnabled, eventReminders, clubAnnouncements, attendanceAlerts — each an independent toggle)
 ├─ Leaderboard (My Rank) — or standalone surface within Campus/Profile; placement TBD, see Section 6
 └─ Dispute Status (visible resolution: PENDING / APPROVED / REJECTED, tied to disputeWindowExpiresAt)
```

**Note on Leaderboard:** the original spec treated this as a 4th tab. With the confirmed 3-tab structure, leaderboard needs a real home — likely inside Campus or Profile. This is now an open placement question for you, not something I should default silently (see Section 6).

---

## 2. Core User Flows (corrected)

### 2.1 Onboarding & Auth

```
Splash
 → Login ("Sign in with Google")
 → [Google OAuth sheet]
 → Domain validation
     ├─ FAIL → INSTITUTIONAL_DOMAIN_NOT_ALLOWED error state
     │    [SPECIFICATION GAP: no defined support/contact path — recommend adding
     │     at minimum a "Wrong account? Try again" CTA until product defines more]
     └─ PASS →
          ├─ New/empty profile → Onboarding checklist flow surfaces on Home
          │    (accelerates time-to-value; exact checklist items not enumerated
          │    in docs excerpt — confirm full list before building)
          └─ Existing profile → Home
```

If the student already has a pending `club_membership` (added by an admin pre-login), it is already active and visible on first login — no separate "you've been added" interstitial exists per the schema; design Home/My Clubs to reflect it as already-there, not as a notification-worthy event unless product wants to add one.

### 2.2 Event Discovery → Registration (Solo)

```
Campus → Discover Feed
 → tap Event Card
 → Event Detail (EventType tag, club, date/time, location, capacity)
 → tap Register
 → Confirm Registration dialog (DECIDED: applies to solo registration too, for consistency with team join/leave)
     ├─ Capacity available → Confirmed → appears in My Events
     └─ Capacity full → Join Waitlist (confirm) → Waitlisted state
```

Cancellation is blocked once `is_locked` is true, or automatically 24 hours after `endTime`. Cancel UI must reflect this — grey out/hide the cancel action rather than letting the student attempt and fail.

Waitlist promotion is **automatic** — when a slot frees up, the system promotes the next eligible student/team and fires a `WAITLIST_PROMOTED` push immediately. No "accept your promotion" step exists; design the notification and My Events status change as the only signal, not an action the student must take.

### 2.3 Event Discovery → Registration (Team)

```
Event Detail (team event)
 → tap Register
 → Team Setup
     ├─ Create Team → name team → invite members via user search (by inviteeId; no shareable codes exist)
     │    → team can register even below minimum_team_size — API returns `below_minimum: true`,
     │      UI must show a visible warning, not block registration
     └─ Join Team (via invite acceptance — confirm dialog required, per docs)
 → Team registered (may show below-minimum warning state)
```

If a member leaves a team that's below capacity, it does **not** open an individual slot for a stranger to join — the team just shrinks. Only if the entire team withdraws does the backend promote the next waitlisted team. Team Management UI should make this distinction clear (leaving ≠ freeing a seat for others).

### 2.4 Live Attendance (Scan modal)

```
Home Feed (attendance window active for a registered event)
 → Scan modal auto-elevates to top of feed with clear CTA
 → tap to open Camera / Scan View
 → scan code
 → Validating
     ├─ SUCCESS → Attendance Marked
     ├─ FAIL: Expired code → re-prompt camera immediately, no dead-end
     ├─ FAIL: GEOFENCE_VERIFICATION_FAILED → flat error message only (DECIDED — no map/distance UI)
     ├─ FAIL: LOCATION_SPOOFING_DETECTED → distinct backend error code from geofence failure;
     │    [copy still needs product decision: does the student-facing message differ from the
     │     geofence-failure message, or should it look identical to avoid signaling detection
     │     to bad actors? Recommend identical neutral copy at UI level even though the codes
     │     differ server-side — flag for product sign-off]
     └─ FAIL: Already marked → idempotent "Already checked in at [time]," not an error tone
```

No client-side scan cooldown/lockout — only general API rate limiting applies. Don't design a "too many attempts, wait 60s" UI unless product adds this later.

**Disputes:** Student-filed, bound by `disputeWindowExpiresAt` (a real deadline — UI must show remaining time, not leave it open-ended). Resolution status (`PENDING` / `APPROVED` / `REJECTED`) is visible to the student on Profile/Event page — design all three states, not just "submitted."

**Manual override:** If an admin manually marks attendance (bypassing geofencing entirely), it must reflect instantly in the student's UI as a normal "Attendance Marked" state — no separate "marked by admin" visual distinction implied by the docs; treat it identically to a successful scan unless told otherwise.

### 2.5 Notifications

Granular preferences, four independent toggles: `pushEnabled`, `eventReminders`, `clubAnnouncements`, `attendanceAlerts`. Design Notification Preferences as four separate switches, not a single master toggle with sub-options implied — they're flat and independent in the schema.

---

## 3. Key States & Edge Cases (revised against real backend codes)

| Area | States to design |
|---|---|
| Registration | Registered / Waitlisted / Waitlist-promoted (automatic, notification-driven) / Cancelled (blocked after lock/24hr-post-event) |
| Team | Complete / Below-minimum (visible warning, not blocking) / Member left (team shrinks) / Team withdrew entirely (triggers waitlist promotion) |
| Attendance | Marked (scan or admin override — same visual state) / Not yet marked / Missed / Disputed-pending / Disputed-approved / Disputed-rejected |
| Scan errors | Expired code (re-prompt) / `GEOFENCE_VERIFICATION_FAILED` (flat message) / `LOCATION_SPOOFING_DETECTED` (copy TBD, likely identical to geofence at UI level) / Already marked (idempotent, neutral) |
| Domain auth | Rejected (support path is a spec gap — needs product decision before final screen) |

---

## 4. Component Inventory (for Stitch handoff)

- **EventCard** (variants: default, live-attendance-active surfaced on Home, waitlist-open, locked)
- **CapacityBadge**
- **RegistrationStatusPill** (registered / waitlisted / below-minimum / cancelled)
- **EventTypeTag** (enum-driven: WORKSHOP, COMPETITION, GUEST_SPEAKER, etc. — confirm full enum before finalizing filter chips)
- **ClubBadge**
- **ClubRoleBadge** (MEMBER / CORE_MEMBER / CLUB_ADMIN — shown as-is, not obscured)
- **HomeFeedActionCard** (the context-aware "needs your attention now" unit — live scan, pending invite, onboarding step)
- **QRScanModal** (camera overlay + all validation/result states, ephemeral not persistent)
- **AttendanceResultCard** (success / expired / geofence-fail / spoof-fail / duplicate)
- **TeamMemberRow** (invite pending / accepted / declined)
- **BelowMinimumWarning** (inline banner on team registration, non-blocking)
- **ConfirmationSheet** (register, join team, leave team — all confirmed per docs + product decision)
- **NotificationPreferenceRow** (4 independent toggles, no nesting)
- **DisputeStatusCard** (pending / approved / rejected, with countdown to `disputeWindowExpiresAt` while pending)
- **EmptyState**

---

## 5. Explicit Non-Goals (V1)

- Avatar/photo upload beyond what Google provides (`avatarUrl` is pulled, not uploaded by the student)
- Club "following" without membership — does not exist in the data model
- Shareable team invite codes — invites are user-search/inviteeId only
- Scan attempt cooldown/lockout UI — not implemented server-side beyond general rate limiting
- Guest passes, certificate generation, event media galleries, multi-campus switching — all previously deferred, still deferred

---

## 6. Specification Gaps — Resolved

Engineering flagged these as gaps rather than guess at them, which was the right call at the time — they touch backend/data-model territory I couldn't verify from a doc excerpt alone. Now resolved as product decisions so Stitch has no ambiguity left to trip on. These should still get written back into `nst-events-docs` so the gap doesn't reopen for the next person who touches this.

**1. Leaderboard placement → Campus tab, as a top-level segment alongside Discover.**
Campus is already "shared community resources" — leaderboard is exactly that, not a personal/profile concern. Inside Campus: a segmented control at the top — `Discover | Leaderboard` — rather than nesting leaderboard inside Club Profile or burying it in Profile where a student would have to leave the exploration context to check rank. A compact "Your rank" summary chip also surfaces on the Home feed action area when a student's rank changes meaningfully (top 10, moved up/down significantly) — reuses the existing "context-aware, act on this now" Home pattern instead of inventing a new one.

**2. Domain-rejected support path → single CTA, no live support channel.**
Screen shows the rejection reason plainly ("This app is only for NST students and faculty — sign in with your @adypu.edu.in or @newtonschool.co email") and one button: "Try a different account," which re-triggers the Google account chooser. No "Contact Admin" link — a login screen is the wrong place to open a support ticket flow, and it invites bad-faith attempts to argue eligibility over chat. If a legitimate student is genuinely locked out (e.g., email typo'd in the roster), that's a human/admin problem solved outside the app, not a UI affordance.

**3. Discover feed structure → single flat feed, filter chips instead of sub-tabs.**
One feed of all `PUBLISHED` events, sorted by soonest-first, with a horizontal filter chip row: `All | My Clubs | [EventType chips]`. "My Clubs" is a filter state on the one feed, not a separate tab or screen — keeps the mental model simple (one list, narrow it) rather than forcing a choice between two feeds that mostly overlap anyway for a student in 2-3 clubs.

**4. `EventType` enum — build filter chips as a data-driven list, not a hardcoded set.**
Don't hardcode `WORKSHOP | COMPETITION | GUEST_SPEAKER` into the Stitch screen as the complete set — those were examples, not confirmed exhaustive. Filter chip component pulls from whatever the enum resolves to at build time. This is a build-instruction, not a design decision: the component must not assume a fixed count of chips (design for 3–8 comfortably wrapping/scrolling horizontally).

**5. Onboarding checklist → three items, tied to what actually unlocks value.**
Given the schema (academic profile, club memberships, no avatar upload), the checklist is:
   - Complete academic profile (Semester, Program, Batch) — required for some event eligibility filtering down the line, cheap to do now
   - Explore your clubs (deep-links to My Clubs if pre-assigned, or Campus if none yet)
   - Turn on event reminders (deep-links to Notification Preferences — getting this on is the single highest-leverage thing for retention)

   Checklist appears as a dismissible card stack on Home, one card visible at a time, auto-dismisses each item on completion, whole card disappears once all three are done or explicitly skipped.

**6. Spoofing vs. geofence copy → identical UI copy, distinct backend codes only.**
Both `GEOFENCE_VERIFICATION_FAILED` and `LOCATION_SPOOFING_DETECTED` render the same student-facing message: "We couldn't verify your location for this event." Same icon, same tone, same recovery CTA (move closer / try again). Reasoning: differentiating the copy teaches anyone probing the system exactly which detection layer caught them, which is a free debugging tool for the next spoofing attempt. The distinction stays valuable in backend logs/admin analytics, where it belongs.

**7. New-membership visibility → silent inclusion, no "Welcome to" moment.**
No interstitial or forced modal on first login for pre-assigned club memberships. It just appears in My Clubs, exactly as read from the schema. A student who was added to a club before ever opening the app is not "onboarding into" that club — they're an existing member who happens to be logging in for the first time. If product wants a moment of delight here later, it's better handled as a one-time notification ("You've been added to Robotics Club") rather than blocking the login flow with a modal — decouple it from auth entirely.

---

## 7. Decisions Made This Session

- Notification center: bell icon, Home tab top header.
- Individual (solo) event registration: confirm dialog required, matching team join/leave pattern.
- Geofence failure: flat error message, no map/distance hint.
- Leaderboard: segmented control inside Campus tab (Discover | Leaderboard), plus a rank-change chip surfaced on Home.
- Domain rejection: single "try a different account" CTA, no support link.
- Discover: single feed with filter chips (My Clubs is a filter, not a separate tab).
- EventType filter chips: data-driven from the enum, not hardcoded to the three examples given.
- Onboarding checklist: academic profile → explore clubs → enable reminders, three dismissible cards.
- Spoofing and geofence failures: identical student-facing copy; distinction kept backend-only.
- Pre-assigned club memberships: silent inclusion, no first-login "welcome" interstitial.

---

## 8. Web Dashboard Exceptions

While this document primarily covers the mobile App UX/IA, the following rules apply specifically to the student web dashboard (`apps/dashboard`):

### 8.1 Desktop Home Composition
The web dashboard Home page uses a **state-aware layout flow** rather than a fixed multi-column grid. It is built in a single vertical stack, constrained to a readable maximum width (`max-w-5xl`), adapting its contents based on the user's active/upcoming schedule:

- **State A (Active / Starting Soon)**:
  - Greeting ("Good morning, [Name]. Here's what's happening around you.")
  - Priority Section (dominant surface-container with primary indicator, showing live event and ticket action)
  - Your Next (single upcoming agenda row, if any)
  - Your Progress (compact horizontal information)
  - Explore Campus (subtle navigation row)
- **State B (No Priority / Upcoming Event)**:
  - Greeting
  - Your Next (strong agenda row)
  - Your Progress
  - Explore Campus
- **State C (Empty / No Upcoming Events)**:
  - Greeting
  - Intentional editorial empty state ("NOTHING SCHEDULED") with inline call-to-action
  - Your Progress
  - Explore Campus

The goal is to maintain intentional composition and avoid forcing empty states into large left/right layout columns.
