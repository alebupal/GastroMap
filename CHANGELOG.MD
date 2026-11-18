# Changelog GastroMap

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-11-18

### Added
- **Core Architecture & Docker**:
  - Next.js 15 (App Router, Server Actions, TypeScript, Tailwind CSS).
  - Standalone multi-stage build via `Dockerfile` and `docker-compose.yml`.
  - Database container with PostgreSQL 16 + PostGIS 3.4 (`postgis/postgis:16-3.4-alpine`).
  - Drizzle ORM configured with initial schema (`users`, `sessions`, `invitations`) and initial migration.
  - Health check endpoint `/api/health` monitoring PostgreSQL and PostGIS versions.
- **CI/CD & Versioning (aligned with TVSPY)**:
  - Multi-arch Docker Hub build workflows (`.github/workflows/docker-image-branches.yml` and `docker-image-releases.yml`).
  - In-app `versionService` and `/api/version` endpoint with update checking against GitHub releases.
  - Multi-language changelog (`CHANGELOG.MD` and `CHANGELOG_ES.MD`).
