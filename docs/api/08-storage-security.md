# Storage Security

> **NOT IN V1**: File uploads are deferred to a later release (V1.1 / V2). NST-Events V1 does not implement file upload endpoints (`POST /upload/presign`, `GET /upload/signed-read`), does not require a storage provider, and uses default/generated fallback assets. All media URL fields in the database are nullable and store `NULL` in V1. The security model below is preserved as **future design guidance** for when file uploads are implemented.

## Intended Bucket Structure (Provider TBD)
1. **`avatars`**: Public user profile pictures.
2. **`club_banners`**: Public club branding.
3. **`event_media`**: Public event posters and attachments.
4. **`secure_documents`**: Private forms, budget proposals, faculty sign-offs.

## Intended Authorization Model
All file upload authorization is handled by the **Express backend**. Clients do not access storage directly with raw credentials. The flow:
1. Client requests an upload authorization from Express (`POST /upload/presign`).
2. Express RBAC middleware validates the user's role.
3. If authorized, Express generates and returns a short-lived pre-signed URL for the specific bucket path.
4. Client uploads directly to storage using the pre-signed URL.

## File Validation (Enforced by Express Before Signing)
* **Allowed Extensions**: `jpg`, `png`, `webp`, `pdf`.
* **Size Limits**: 5MB for images, 10MB for PDFs.
* **MIME Type**: Validated server-side before the pre-signed URL is issued.

## Folder Isolation (Intended)
Folders inside buckets mirror database UUIDs. A user can only upload an avatar into `avatars/<user_id>/`. This is enforced by Express generating the correct path during pre-signing.

## Media Ownership
All media references in the database (e.g., `avatar_url`, `banner_url`) must point to objects the user is authorized to own. Orphaned objects must be cleaned up by a background maintenance task.

## URL Validation on DB Updates — Critical Security Requirement

After a client uploads a file via the pre-signed URL, it calls the relevant API to update the DB column (e.g., `PATCH /users/me` with `{ avatar_url }`). The Express backend **must NOT** blindly accept client-provided URLs. Before writing to the database, Express must:

1. **Validate the URL domain**: The URL must match the approved storage domain (e.g., `*.r2.cloudflarestorage.com`, `*.s3.amazonaws.com`, or the configured MinIO host).
2. **Validate the path pattern**: The URL must match the expected bucket and path pattern (e.g., `avatars/<user_id>/...` for avatar updates).
3. **Reject all other URLs**: Any URL pointing to an external domain, an internal network address (SSRF), or a different user's path must be rejected with `400 Bad Request`.

This prevents a malicious client from injecting phishing links, inappropriate external content, or SSRF targets into platform profiles and events.

## Threats & Mitigations (Intended)
* **Malicious file upload**: Mitigated by MIME type and extension validation in the Express pre-signing handler before any URL is issued.
* **Unauthorized access to secure_documents**: Mitigated by RBAC middleware checking `FACULTY` or `PLATFORM_ADMIN` role before generating a signed read URL.
* **SSRF / Arbitrary URL injection**: Mitigated by strict domain and path validation on all API endpoints that accept media URLs from clients (see URL Validation section above).
