# Enums

> **Status**: FROZEN | **Version**: 1.2 | **Date**: 2026-08-04  
> All enum definitions here are canonical. Every other document (Prisma schema, table catalog, API contracts, schema-architecture) must match this file exactly.

---

## `event_state` (formerly `event_status`)
Tracks the approval and visibility lifecycle of an event.
* `DRAFT` — Being authored by Club Admin. Not visible to students.
* `PENDING_APPROVAL` — Submitted for Faculty review. Locked from Club Admin edits.
* `PUBLISHED` — Faculty-approved. Visible on the student feed; accepts registrations.
* `ARCHIVED` — Event date has passed. Read-only. Locked from attendance scans and registrations.

## `event_visibility`
Controls whether a published event is visible campus-wide or restricted.
* `PUBLIC` — Event is visible to all authenticated users on the student feed.
* `PRIVATE` — Event is visible only to members of the hosting club(s).

## `registration_status`
Manages attendee state and capacity limits.
* `REGISTERED` — Confirmed seat.
* `WAITLISTED` — Capacity full; user promoted FIFO when a seat opens.
* `CANCELLED` — User cancelled or organizer removed.

## `registration_type`
Declares whether an event accepts individual or team-based registration.
* `INDIVIDUAL` — Each user registers independently.
* `TEAM` — Users register as part of a team (use with `teams` table).

## `attendance_status`
The formal record of a user's presence for a session.
* `PRESENT` — User scanned QR code within the geofence during the valid window.
* `ABSENT` — Session closed with no attendance record for the user.
* `EXCUSED` — Attendance dispute was reviewed and **APPROVED** by an organizer. Distinct from `PRESENT` (organizer-granted) and `ABSENT` (default). Used exclusively as the `status` value written by the `resolve_attendance_dispute` RPC when `resolution = 'APPROVED'`.

## `attendance_method`
Records how an attendance entry was created.
* `QR` — User self-scanned a dynamic QR code within the geofence and time window.
* `MANUAL` — Organizer or faculty manually marked the user's attendance.
* `SYSTEM` — Attendance was recorded by an automated system action (e.g., dispute resolution writing an EXCUSED record).

## `event_type`
Categorizes the generic event model. The `metadata` JSONB field carries type-specific fields.
* `WORKSHOP` — Hands-on skill session.
* `SEMINAR` — Lecture, guest talk, or panel discussion.
* `COMPETITION` — Judged contest (use with `event_results`).
* `MEETUP` — Informal gathering or networking event.
* `HACKATHON` — Extended team-based build challenge (use with `teams`).
* `OTHER` — Catch-all for events that do not fit the above categories.

## `club_status`
Tracks the operational lifecycle of a club.
* `ACTIVE` — Club is operating normally. Default state.
* `INACTIVE` — Club is temporarily suspended or dormant. Events cannot be created. Platform Admin-only transition.
* `DISSOLVED` — Club has been permanently closed. Soft-deleted. No further operations permitted. Platform Admin-only transition.

## `global_role`
* `STUDENT` — Default role for all institutional email holders.
* `FACULTY_ADMIN` — Faculty with platform-wide administrative privileges.
* `PLATFORM_ADMIN` — Superuser with complete system access.

## `club_role`
* `FACULTY_MENTOR`
* `CLUB_ADMIN`
* `CORE_MEMBER`
* `MEMBER`

### `participation_role`
Used in `event_registrations`.
* `ATTENDEE`: User attended event successfully (Default upon check-in).
* `VOLUNTEER`: User actively helped operate event.
* `ORGANIZER`: User was part of official event organizing team.
* `SPEAKER`: User delivered session, workshop, or talk.
* `MENTOR`: User acted as mentor, reviewer, judge, or advisor.

### `competition_result`
Used in `event_results`.
* `WINNER`: 1st Place.
* `RUNNER_UP`: 2nd Place.
* `SECOND_RUNNER_UP`: 3rd Place.
* `TOP_10`: Ranked inside top ten but not podium.
* `PARTICIPANT`: Participated successfully but did not place.

## `dispute_status`
Tracks the state of an attendance dispute.
* `PENDING`
* `APPROVED`
* `REJECTED`

## `handover_status`
Manages the club leadership transfer lifecycle.
* `PENDING`
* `APPROVED`
* `REJECTED`

## `attendance_type_enum`
Defines whether an event requires one check-in or multiple.
* `SINGLE`
* `MULTI_SESSION`
