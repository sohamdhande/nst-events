# Rate Limiting Strategy

Rate limiting is enforced at the **Express API** layer via middleware (e.g., `express-rate-limit`). Limits are applied per user ID (authenticated) or per IP (unauthenticated).

## Defined Limits
* **Authentication** (`POST /auth/callback`): 10 requests per minute per IP — prevents brute-force OAuth abuse.
* **Attendance** (`POST /attendance/mark`): 5 requests per minute per user — prevents brute-forcing the QR TOTP window.
* **QR Generation** (`POST /attendance/generate-qr`): 10 requests per minute per user.
* **Registrations** (`POST /events/:id/register`): 10 requests per minute per user.
* **Team Operations**: 20 requests per hour per user.
* **Media Uploads** (pre-signed URL generation): 10 requests per hour per user.
* **Admin Actions**: Higher limits (100/min) for authenticated Dashboard users with Admin roles.
* **Notifications**: Clubs restricted to 2 broadcast notifications per week (enforced at the service layer, not the HTTP rate limiter).

## Documented Reasoning
These limits protect the database from connection exhaustion and prevent malicious actors from scripting mass-registrations to block legitimate students from attending limited-capacity events. The QR attendance limit specifically prevents TOTP brute-forcing within the 45-second effective validity window (Clarified by ADR-005).

