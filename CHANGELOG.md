# Changelog

All notable changes to the **NST Events** platform will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-08-04

### Added
- **Database Schema**: 19 domain tables and 15 canonical enums implemented via Prisma ORM in `packages/database`.
- **Initial SQL Migration**: `20260803000000_init` initial schema migration SQL with PostGIS, constraints, and composite indexes.
- **Database Seed Script**: Fully idempotent seeding script for development and integration environments across all 18 target domain entities.
- **Workspace Architecture**: Monorepo structure using `pnpm` workspaces and `Turborepo` comprising `apps/api`, `apps/dashboard`, `apps/mobile`, `apps/worker`, `packages/database`, `packages/shared`, and `packages/config`.
- **CI/CD Pipeline**: GitHub Actions workflows for continuous integration (`ci.yml`) and automated deployment (`deploy.yml`).
