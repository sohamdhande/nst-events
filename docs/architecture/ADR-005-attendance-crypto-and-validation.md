# ADR-005: Attendance Crypto and Validation Specifications

## Background
Phase 5 Milestone 2 introduces the core dynamic QR attendance validation flow. During the initial implementation planning, several critical architectural ambiguities were discovered in the documentation:
1. The exact source of the cryptographic secret for TOTP generation was undefined.
2. The `qr_payload` structural format was undefined.
3. The precise behavior regarding TOTP clock drift and network latency tolerance was unspecified.
4. The API contract requires `flagged` and `points_awarded` fields to be returned by `POST /attendance/mark`, but the `mark_attendance` RPC was documented to strictly return `attendance_records`, which does not natively house these derived ephemeral fields.
5. Exact error code mappings between PostgreSQL RPC validations and Express HTTP responses were missing.

## Problem
Implementing without resolving these ambiguities would lead to security vulnerabilities (e.g., key reuse), brittle integrations (e.g., rigid clock synchronization failing on mobile devices), and undocumented "magic" logic inside the codebase that strays from the specification.

## Decision

### 1. Attendance QR Secret
**Decision:** Introduce a dedicated `ATTENDANCE_QR_SECRET` environment variable.
**Rationale:** Reusing the `JWT_SECRET` violates the principle of least privilege and cryptographic separation of concerns. A dedicated secret allows organizers to rotate QR keys without invalidating all user sessions. 

### 2. QR Payload Format
**Decision:** Use a versioned, colon-separated payload encoded in Base64URL for compactness and QR code efficiency.
**Payload Structure:** `<version>:<session_id>:<hmac_signature>`
- **Version:** `v1` (to allow future schema evolutions).
- **HMAC Input:** `v1:{session_id}:{window_epoch}`
- **Signature:** First 16 characters of the HMAC-SHA256 hash (Base64URL encoded) of the input using `ATTENDANCE_QR_SECRET`. (Truncated to optimize QR density while maintaining sufficient entropy for a 15-second lifespan).

### 3. TOTP Window Policy
**Decision:** Accept `Current ± 1 window` (Strictly: `window_epoch - 1`, `window_epoch`, and `window_epoch + 1`).
**Rationale:** While the token rotates every 15 seconds, strict enforcement of a single window leads to a high failure rate in crowded events due to 3G/4G network latency and minor mobile device clock drift. Accepting ±1 window creates a graceful 45-second tolerance while still completely neutralizing long-term replay attacks.

### 4. `mark_attendance` RPC Contract
**Decision:** Maintain `RETURNS attendance_records` to preserve repository consistency, while assigning the Express Service layer the responsibility of deriving the HTTP response fields (`flagged` and `points_awarded`).
**Rationale:** 
- `mark_attendance` remains consistent with all other mutation RPCs by returning the native Prisma table row (`attendance_records`).
- The `audit_metadata` JSONB column remains strictly reserved for immutable forensic audit facts (e.g., `device_collision_detected: true`, `device_id`, `app_version`).
- The Express Service maps the API's `flagged` response by evaluating `audit_metadata.device_collision_detected`.
- The Express Service determines `points_awarded` from a centralized application scoring policy (e.g., `SCORE_RULES.ATTENDANCE = 5`), avoiding an extra database `SELECT` query and keeping scoring logic easily maintainable outside the database.

### 5. Error Contract Mapping
**Decision:** Define the following canonical mapping between RPC failures and HTTP responses:

| Condition | HTTP Status | Error Code | Message |
| :--- | :--- | :--- | :--- |
| Expired / Invalid QR | `422 Unprocessable Entity` | `QR_EXPIRED` | "The QR code has expired or is invalid. Please scan the latest code." |
| Outside Geofence | `422 Unprocessable Entity` | `OUTSIDE_GEOFENCE` | "You are not within the required distance of the event venue." |
| Mock Location | `422 Unprocessable Entity` | `MOCK_LOCATION_REJECTED` | "Mock location detected. Please disable GPS spoofing." |
| Event Locked | `422 Unprocessable Entity` | `EVENT_LOCKED` | "Attendance marking is currently locked for this event." |
| Session Closed | `422 Unprocessable Entity` | `SESSION_CLOSED` | "The attendance session is closed or has not started." |
| Not Registered | `422 Unprocessable Entity` | `NOT_REGISTERED` | "You must be registered for the event to mark attendance." |
| Already Attended | `200 OK` (Idempotent) | N/A | Returns the existing record details. |
| Device Collision | `201 Created` | N/A | Success, but returns `flagged: true` in the payload. |

## Alternatives Considered
- **Strict 15s Window**: Rejected due to unacceptable user experience in high-density campus areas with poor cellular reception.
- **Returning custom Postgres TYPE**: Rejected due to Prisma introspection complexities and unnecessary database schema clutter.

## Consequences
- Requires updating `env.ts` and infrastructure pipelines to inject `ATTENDANCE_QR_SECRET`.
- The Express attendance service must import a centralized `SCORE_RULES` policy to construct the final API response.

## Compatibility
Fully compatible with the existing `04-api-contract-freeze.md`. This ADR merely solidifies the undefined implementation mechanics underlying those contracts.

## Future Considerations
If QR density becomes a bottleneck for older mobile cameras, we may transition from HMAC-SHA256 truncation to a shorter cryptographic MAC optimized specifically for TOTP.
