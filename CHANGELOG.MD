# Changelog GastroMap

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-11-18

### Added
- **Core Architecture & Docker (Phase 0)**:
  - Next.js 15 (App Router, Server Actions, TypeScript, Tailwind CSS).
  - Standalone multi-stage build via `Dockerfile` and `docker-compose.yml`.
  - Database container with PostgreSQL 16 + PostGIS 3.4 (`postgis/postgis:16-3.4-alpine`).
  - Drizzle ORM configured with initial schema (`users`, `sessions`, `invitations`) and migrations.
  - Health check endpoint `/api/health` monitoring PostgreSQL and PostGIS versions.
- **CI/CD & Versioning (aligned with TVSPY)**:
  - Multi-arch Docker Hub build workflows (`.github/workflows/docker-image-branches.yml` and `docker-image-releases.yml`).
  - In-app `versionService` and `/api/version` endpoint with update checking against GitHub releases.
  - Multi-language changelog (`CHANGELOG.MD` and `CHANGELOG_ES.MD`).
- **Authentication & Invitation System (Phase 1)**:
  - Initial setup wizard (`/setup`) to initialize the database and create the first administrator account.
  - Database-backed session authentication (`sessions`) with secure Argon2id password hashing and HTTP-only cookies.
  - Private invitation system with unique cryptographic tokens and expiration (`/invite/[token]`).
  - Administrative invitation manager (`InviteManager`) for creating, copying, and revoking registration links.
- **Gastronomic Catalog & Taxonomy Management (Phase 2)**:
  - Relational schema in Drizzle ORM for `places`, `occasions`, `tags`, and join tables (`place_occasions`, `place_tags`).
  - Place creation page (`/new`) featuring estimated price level picker (€, €€, €€€, €€€€), ratings, and personal notes.
  - Interactive visual chip/pill selector for multi-category and multi-tag assignment (no comma-separated text boxes).
  - Comprehensive taxonomy management dashboard (`TaxonomyManager`):
    - Real-time place counts per occasion and tag.
    - Category and tag merging functionality (`mergeOccasionsAction`, `mergeTagsAction`).
    - Safe deletion with prompt to reassign associated places or unlink cleanly.
  - Renamed default category to "Comer".
- **Licensing, Branding & AI Collaboration Guidelines**:
  - GNU General Public License v3.0 ([LICENSE](LICENSE)).
  - Clean vector SVG favicon ([public/icon.svg](public/icon.svg)).
  - Detailed contribution guides tailored for both AI agents and human contributors in [README.MD](README.MD) and [README_ES.MD](README_ES.MD).
  - Standardized Pull Request template ([.github/pull_request_template.md](.github/pull_request_template.md)).
- **Build Performance & Docker Caching**:
  - Added `.dockerignore` to streamline Docker build context and exclude large local directories.
  - Added BuildKit cache mounts in `Dockerfile` for npm downloads (`/root/.npm`) and Next.js compiler artifacts (`/app/.next/cache`).
  - Enabled GitHub Actions layer cache (`type=gha`, `mode=max`) across multi-architecture CI workflows.
