# Architecture Decision Summary

This document summarizes the core architectural pillars of the NST-Events platform.

## High-Level Architecture
* **Frontend Mobile**: Expo React Native (Student-first experience).
* **Frontend Web**: Next.js (Administration, Event Management, Analytics).
* **Backend**: Custom Node.js + Express + TypeScript REST API. All clients communicate exclusively with Express — never directly with the database.
* **ORM**: Prisma — all database queries are executed through Prisma. TypeScript types are generated from the Prisma schema.
* **Database Engine**: PostgreSQL with Row Level Security (RLS) as a secondary defense-in-depth layer.
* **Server-Side Logic**: Express route handlers (Node.js) and the separate `nst-worker` deployment. No separate serverless runtime.
* **Storage**: File storage provider TBD for V1 (see ADR-008).
* **Deployment**: NST Cluster (5-node K3s Kubernetes). Local dev: Docker Compose.

## Architectural Decisions Summary
All fundamental architectural patterns have been documented in `/adrs`. 
The vast majority of structural decisions have been **Accepted**.

* **Accepted**: 34 records (including core stack, authorization logic, approval workflows, generic event models, and basic spoofing detection).
* **Rejected**: 5 records (including mobile admin workflows, static QR codes, and device cryptographic signing in V1).
* **Under Review**: 2 records — ADR-008 and ADR-024 (file storage provider not yet decided).

Please refer to `adrs/README.md` for a complete index of all decisions.
