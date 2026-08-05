# Changelog

All notable changes to the **NST Events** platform will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
