# NST-Events

NST-Events is a campus event management platform built for Newton School of Technology (NST), Pune, designed to unify student events, club operations, attendance, and communication into one digital system.

The platform allows students to discover and register for campus events, track schedules, monitor leaderboards, and manage participation, while club leadership and platform administrators create events, manage attendance, and control club-level and campus-wide operations.

Target scale: 3000+ active students, single campus, V1.

## Overview

NST-Events is designed to solve common campus event challenges:

- fragmented event communication
- manual, error-prone registrations
- proxy/fraudulent attendance marking
- disconnected club operations
- poor visibility into campus-wide activity

The goal is a centralized event ecosystem where every club and campus activity runs through one platform, with attendance that's actually trustworthy.

## Core Features

### Student Features
- Institutional email login (Google OAuth, domain-restricted)
- Event discovery across all campus clubs
- Individual and team event registration, with waitlisting
- Event schedule and personal registration history
- Dynamic QR-based attendance (TOTP + geofence validated)
- Leaderboard access
- Push and in-app notifications for event updates
- Personal profile management

### Club Admin / Core Member Features
- Club-specific dashboard
- Create, edit, and manage club events through an approval workflow
- Generate dynamic QR attendance sessions
- View participant lists and attendance analytics
- Manage club roster and membership roles
- Handle attendance disputes
- Leadership handover workflow

### Faculty & Platform Admin Features
- Faculty oversight and approval authority over academic/faculty-led events
- Manage all users, clubs, and club role assignments
- Approve, reject, or intervene on event lifecycle
- Campus-wide analytics and audit log review
- System-wide notification and permission control

## Multi-Club Architecture

NST-Events supports multiple clubs operating independently within the same campus ecosystem — each with its own membership, events, and announcements, while sharing the same underlying platform and attendance/leaderboard infrastructure.

## Role System

NST-Events uses a **two-tier role model**, not a single flat hierarchy:

- **Global role** (`global_role`) — one per user, platform-wide: `STUDENT`, `FACULTY_ADMIN`, `PLATFORM_ADMIN`
- **Club role** (`club_role`) — scoped per club membership: `FACULTY_MENTOR`, `CLUB_ADMIN`, `CORE_MEMBER`, `MEMBER`

A user can hold different club roles across different clubs simultaneously (e.g., `CLUB_ADMIN` in one club, `MEMBER` in another) while holding a single global role. Authorization is enforced by two independent layers that must both agree: Express RBAC (primary) and PostgreSQL Row-Level Security (defense-in-depth).

## Authentication

Login is restricted to institutional email domains only:

```
@adypu.edu.in (students)
@newtonschool.co (faculty, management)
```

**Flow:**
1. User authenticates via Google OAuth
2. Express backend owns the full OAuth lifecycle, validates domain, upserts user by `google_sub`
3. Backend issues a 15-minute JWT + 30-day rotating refresh token (HttpOnly, Secure, SameSite=Strict cookie)
4. UI adapts based on resolved global and club roles

## Attendance System

NST-Events uses **dynamic, cryptographically rotating QR codes** — not static QR codes — specifically to defeat screenshot sharing and proxy attendance.

**Flow:**
1. Organizer projects a TOTP-seeded QR code that rotates every 15 seconds
2. Student scans the code within the mobile app
3. Backend validates the TOTP window (HMAC), enforces PostGIS geofencing, and checks for mock-location spoofing
4. Attendance is marked instantly on success

**Why dynamic QR:**
- Removes manual attendance tracking
- Makes screenshot/proxy attendance sharing ineffective (code expires in 15s)
- Geofencing ensures physical presence, not just possession of the code

Organizer devices support offline attendance caching in Operations Mode (trusted, audited); student devices always validate synchronously against the live TOTP window and geofence.

## System Architecture

| Layer | Technology |
|---|---|
| Mobile App | Expo React Native |
| Web Dashboard | Next.js |
| API Server | Node.js + Express + TypeScript |
| Queue Worker | Node.js (separate deployment from API) |
| ORM | Prisma |
| Database | PostgreSQL (+ PostGIS, pgmq) |
| Auth | Google OAuth 2.0, Express-owned lifecycle |
| Authorization | Express RBAC (primary) + PostgreSQL RLS (secondary) |
| Real-time | Server-Sent Events (no WebSockets in V1) |
| Notifications | Expo Push via dedicated worker + pgmq |
| Deployment | Kubernetes (K3s), NST Cluster |

Backend follows a router → service → schema module pattern per domain (auth, users, clubs, events, registrations, attendance, notifications, leaderboard, admin, sse).

## UI Philosophy

NST-Events follows a clean, high-density institutional design system, built for operational efficiency during live events (Operations Mode) without sacrificing everyday polish.

- **Typography**: Geist Sans
- **Color system**: Semantic tokens (not literal hues), enabling Dark Mode and future multi-campus theming out of the box
- **Design goals**: information-dense where it matters (dashboards, operations mode), frictionless for passive browsing, deliberately frictioned for destructive or high-stakes actions (e.g. rejecting an event, check-in confirmation)

## Future Expansion (Not in V1)

The following are explicitly deferred, with architecture left ready to support them later:

- File uploads (avatars, banners, media) — V1 uses default/generated fallback assets
- Certificate generation and verification
- Club recruitment workflows
- Event media galleries
- Multi-campus deployment (`tenant_id` groundwork exists in schema)

Guest event passes and optimistic-UI registration were explicitly evaluated and **rejected** for V1 — not just deferred.

## Repository

Architecture, ADRs, and the full implementation blueprint live in the companion **[NST-Events Docs](https://github.com/sohamdhande/nst-events-docs)** repository — the single source of truth for all technical decisions. Start with `MASTER_CONTEXT.md` there before making any change here.

## Long-Term Vision

NST-Events is intended to become the campus operating layer for NST — where events, clubs, participation, and communication are all managed through one scalable, trustworthy digital system.
