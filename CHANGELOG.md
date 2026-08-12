# Changelog

All notable changes to the **NST Events** platform will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Security
- Hardened PostgreSQL `SECURITY DEFINER` boundaries (stripped `search_path`, dropped `TEMP` privileges).
- Improved `global_role` protection via database triggers.
- Strengthened Worker database isolation (restricted to `nst_worker`).
- Hardened QR validation with cryptographic replay protection.
- Hardened authentication rate limiting.

### Infrastructure
- Hardened Kubernetes security contexts (unprivileged, read-only root).
- Restricted PostgreSQL network ingress via `postgres-network-policy`.

### Testing
- Expanded security regression coverage for RLS under concurrent loads.
- Isolated Phase 19 experimental logic to prevent pipeline pollution.

## [1.0.0] - 2026-08-07

### Changed
- Transitioned API and background worker output to structured JSON logging.

### Removed
- Cleared legacy scaffolding, unused stubs, and development artifacts from the repository.
- Dropped external messaging queue extensions from local Docker environments in favor of native solutions.

### Infrastructure
- Added explicit CPU and memory resource constraints to Kubernetes deployment manifests.
- Added HTTP liveness probes to API and Worker deployment configurations for readiness verification.
- Aligned worker service ports across local and containerized environments.

## [0.7.0] - 2026-08-07

### Added
- React Native mobile application structure and routing foundation.
- Mobile registration and live event integration hooks communicating with the API.
- Device push token registration hooks for mobile clients.
- Client-side Server-Sent Events (SSE) connection manager maintaining resilient realtime subscriptions.

## [0.6.0] - 2026-08-07

### Added
- Server-Sent Events (SSE) transport layer API for streaming realtime state changes.
- PostgreSQL `LISTEN/NOTIFY` triggers broadcasting database row updates to connected API clients.

## [0.5.0] - 2026-08-07

### Added
- Registration API supporting capacity validation and enrollment workflows.
- Teams API enabling team creation and roster management.

## [0.4.0] - 2026-08-07

### Added
- Push notification dispatch service leveraging Expo Server SDK.
- Dedicated background worker process for asynchronous task execution.
- Dead-letter queue endpoints for monitoring and replaying failed background tasks.

## [0.3.0] - 2026-08-06

### Added
- Role-Based Access Control (RBAC) authorization middleware.
- Users and Clubs APIs for account and membership management.
- Event system API for scheduling and metadata management.
- Attendance API supporting TOTP-based QR code generation and validation.
- GPS coordinate and accuracy validation for physical check-ins.
- Offline synchronization endpoints for batched attendance records.
- Dispute resolution and manual override endpoints for attendance anomalies.
- Leaderboard API calculating points from event participation.

### Fixed
- Corrected database schema drift and enforced Row-Level Security (RLS) policies on core tables.

### Security
- Added `nst_app` database role and audit triggers restricting direct schema access.

## [0.2.0] - 2026-08-05

### Added
- Google OAuth login flow (`GET /auth/google`, `GET /auth/google/callback`) with domain restriction to `@adypu.edu.in` and `@newtonschool.co`
- JWT access tokens (HS256, 15-minute expiry, `sub`-only payload)
- Opaque refresh tokens with SHA-256 hashing, 30-day expiry, HttpOnly/Secure/SameSite=Strict cookies
- Refresh token rotation (`POST /auth/refresh`) with family-based theft detection and a 5-second grace window to prevent false positives on concurrent requests
- Logout endpoint (`POST /auth/logout`) with token revocation and cookie clearing
- `authenticate` middleware for protected routes
- `withUserContext(userId, fn)` Prisma transaction wrapper for RLS session variable injection
- OAuth CSRF protection via signed `state` cookie
- Index on `refresh_tokens.family_id` for efficient family-wide revocation queries

### Fixed
- Concurrent OAuth signup race condition (P2002 on `email` unique constraint) now recovers by re-fetching instead of failing
- `COOKIE_SECRET` isolated from `JWT_SECRET` (previously conflated)

### Security
- Soft-deleted users (`deletedAt IS NOT NULL`) rejected at both login and refresh

## [0.1.0] - 2026-08-04

### Added
- **Database Schema**: 19 domain tables and 15 canonical enums implemented via Prisma ORM in `packages/database`.
- **Initial SQL Migration**: `20260803000000_init` initial schema migration SQL with PostGIS, constraints, and composite indexes.
- **Database Seed Script**: Fully idempotent seeding script for development and integration environments across all 18 target domain entities.
- **Workspace Architecture**: Monorepo structure using `pnpm` workspaces and `Turborepo` comprising `apps/api`, `apps/dashboard`, `apps/mobile`, `apps/worker`, `packages/database`, `packages/shared`, and `packages/config`.
- **CI/CD Pipeline**: GitHub Actions workflows for continuous integration (`ci.yml`) and automated deployment (`deploy.yml`).
