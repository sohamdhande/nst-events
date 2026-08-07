# Core Relationships

## User → Club Membership
* **Cardinality**: 1:N
* **Explanation**: A user can be in many clubs. The `club_memberships` table contains the enum `role` defining their privileges within that specific club. This is the cornerstone of our contextual RBAC system.

## User → Event Registration
* **Cardinality**: 1:N
* **Explanation**: A user's intent to attend an event. Registrations act as a prerequisite gate before a user is allowed to scan an attendance QR code.

## Club → Event (via `event_clubs`)
* **Cardinality**: M:N
* **Explanation**: Events are rarely isolated. Two clubs can co-host an event. `event_clubs` includes a boolean `is_primary` to dictate which club holds the main budget/admin rights.

## Event → Attendance Session
* **Cardinality**: 1:N
* **Explanation**: An event can span 3 days. Instead of logging attendance against the event, users log attendance against Day 1, Day 2, etc. If it's a simple 1-hour event, exactly one session is automatically generated.

## Event Results
* `event_results.event_id` -> `events.id`
* `event_results.user_id` -> `users.id`
* `event_results.created_by` -> `users.id`
