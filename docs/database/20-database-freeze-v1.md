# Database Freeze V1

## Status
FROZEN

## Version
1.0

## Date
2026-06-05

## Accepted Risks
* Monolithic database structure (All domains in one database).
* High reliance on PostGIS for core flow.
* Express background worker must reliably poll `native queue` and handle queue failures gracefully.

## Known Tradeoffs
* Soft deletes using views add slight overhead to basic `SELECT` queries.
* Full Text Search ranking is basic compared to Elasticsearch.

## Future Improvements (Not In Scope For V1)
* **File uploads deferred**: No file storage provider required for V1. All media URL fields (`avatar_url`, `banner_url`) are nullable and store `NULL`. V1 uses default/generated fallback assets. Storage provider will be selected in V1.1/V2.
* Advanced analytics postponed (Using basic aggregate queries).
* No cryptographic device signing (Relying on basic heuristics + Geofencing + Dynamic QR).
* Database partitioning for `attendance_records` postponed until year 2.

## Resolved Issues (Phase 1-4)
* Table naming contradictions (`attendance_sessions`, `club_memberships`) have been fixed.
* Leaderboard is now officially modeled as a materialized view (`club_leaderboard_mv` and `student_leaderboard_mv`).
* Added missing tables: `attendance_disputes`, `leadership_handover_requests`, `club_leaderboard_mv`, `student_leaderboard_mv`.
* Added missing columns: `audit_metadata` (to `attendance_records`), `attendance_type`, `is_locked` (to `events`), and `open_at`, `close_at`, `geofence_radius` (to `attendance_sessions`).

## Resolved Issues (Post-Audit Freeze Pass — 2026-06-09)
* Added `max_capacity` (nullable INTEGER) and `registration_count` (INTEGER, default 0) to `events` table for lock-free atomic increment capacity updates (`UPDATE ... WHERE registration_count < max_capacity RETURNING registration_count`).
* Leaderboard materialized view refresh changed from row-level triggers to `pg_cron` scheduled refresh every 5 minutes.
* Soft-delete cascade behavior moved from application-layer to PostgreSQL database triggers.
* `audit_logs.actor_id` now explicitly documented as populated by `current_user_id()` reading `app.user_id` session variable.
* Removed phantom `user_roles` and `faculty_clubs` tables from policy matrix. `users.global_role` is the single source of truth.
