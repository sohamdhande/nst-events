# Leaderboard Data Model

## Derived Architecture
The Leaderboard is purely a **Derived View**, but the materialized views must aggregate **ONLY** from the `leaderboard_scores` table. 

**Canonical Path:**
`attendance_records` / `event_results` -> RPC -> `leaderboard_scores` -> `materialized views`

Materialized views MUST NEVER aggregate `attendance_records` or `event_registrations` directly. This prevents double-counting and performance degradation.

## Merit-Based Point Model
Points are inserted into the `leaderboard_scores` table via dedicated RPCs (`award_attendance_points`, `award_competition_points`) based on the following constants:

### Attendance Roles (from `event_registrations.participation_role`)
* `ATTENDEE`: +10
* `VOLUNTEER`: +20
* `ORGANIZER`: +30
* `SPEAKER`: +40
* `MENTOR`: +40
* Session Attendance: +5

### Competition Results (from `event_results.result_type`)
* `PARTICIPANT`: +15
* `TOP_10`: +30
* `SECOND_RUNNER_UP`: +40
* `RUNNER_UP`: +50
* `WINNER`: +75

## Materialized View Refresh Strategy

Leaderboard materialized views (`club_leaderboard_mv` and `student_leaderboard_mv`) aggregate **only** the `leaderboard_scores` table.
They are refreshed **asynchronously** via a `pg_cron` scheduled job every **5 minutes** using `REFRESH MATERIALIZED VIEW CONCURRENTLY`. Views are **never** refreshed by row-level triggers or on individual writes to avoid lock contention.

Platform Admin may also trigger a manual refresh via `POST /admin/leaderboard/recalculate`.

## Abuse Prevention
Manual point insertion is strictly prohibited. Points are derived exclusively via RPCs that validate Attendance Records, Participation Roles, and Competition Results before inserting into `leaderboard_scores`. 
Only the Platform Admin may perform an `ADJUST_POINTS` RPC for disciplinary reasons, which writes directly to `leaderboard_scores` and enforces strict audit logging.
