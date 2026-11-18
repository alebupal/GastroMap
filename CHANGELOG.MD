# Changelog GastroMap

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-11-18

### Added
- **Base Architecture & Docker (Phase 0)**:
  - Next.js 15 (App Router, Server Actions, TypeScript, Tailwind CSS).
  - Multi-stage standalone build in `Dockerfile` and `docker-compose.yml`.
  - Database container with PostgreSQL 16 and PostGIS 3.4 (`postgis/postgis:16-3.4-alpine`).
  - Drizzle ORM configured with initial schema (`users`, `sessions`, `invitations`) and migrations applied.
  - Health check endpoint at `/api/health` verifying PostgreSQL and PostGIS connectivity.
- **CI/CD & Version Service (aligned with TVSPY)**:
  - Multi-arch Docker Hub GitHub Actions workflows (`linux/amd64`, `linux/arm64`) for branches and releases.
  - Built-in version check service (`versionService.ts`) and `/api/version` endpoint comparing against GitHub Releases.
  - Standardized changelogs in `CHANGELOG.MD` and `CHANGELOG_ES.MD`.
- **Authentication & Invite System (Phase 1)**:
  - Initial setup wizard (`/setup`) to initialize the database and create the first administrator.
  - Persistent database sessions (`sessions`) with secure Argon2id password hashing and HTTP-only cookies.
  - Private invitation-only registration system with cryptographic tokens and expiration (`/invite/[token]`).
  - Admin dashboard for invite generation and revocation (`InviteManager`).
- **Gastronomic Catalog & Taxonomy Management (Phase 2)**:
  - Relational Drizzle schema for establishments (`places`), occasions (`occasions`), tags (`tags`), and link tables.
  - Fast ingestion form (`/new`) with budget selection (€ to €€€€), personal ratings, and notes.
  - Interactive chip-based selector for multiple occasions and tags without comma-separated text fields.
  - Comprehensive taxonomy admin manager (`TaxonomyManager`) with live place count, duplicate merger, and safe deletion.
- **Geolocation & Interactive Map (Phase 3)**:
  - Interactive map powered by Leaflet and OpenStreetMap / CartoDB tiles (`MapView.tsx` & `MapContainerWrapper.tsx`).
  - Themed SVG pin markers with occasion colors, central emojis, and drop shadows (`createPlaceMarkerIcon`).
  - Rich popups with establishment details and direct GPS directions ("Get directions ↗").
  - "Near me" mode with browser geolocation and dynamic radius selector (1, 2, 5, 10 km or unrestricted).
  - Spatial PostGIS queries calculating real distances (`ST_Distance`) and radius filtering (`ST_DWithin`).
  - Distance badge on cards and popups (`📍 350 m`, `📍 1.4 km`).
  - Unified explorer with live search and bidirectional map/list sync.
  - Closed location hierarchy picker for Spanish regions (`spanishLocations.ts`) and OpenStreetMap/Nominatim smart address geocoding (`geocoding.ts`).
- **Personal Collection & User Statuses (Phase 4)**:
  - Favorites system (⭐ / 🤍) persisted per user in `user_places`.
  - Independent personal statuses: "Want to go (Pending 🕒)" and "Been there (Visited ✅)".
  - 0-10 personal ratings with decimal precision and visual badges on cards.
  - Private notes («🔒 My note») with dedicated interactive modal, visible only to their author.
- **Decision Assistant & Random Picker (Phase 4)**:
  - Guided assistant «🎯 Find a place» (`DecisionAssistantModal`) covering Occasion, Price Range, Location/Radius, and Group Experience.
  - Interactive random picker with **«🎲 Pick at random»** button and spinning roulette modal (`RandomPickerModal`).
  - Dynamic Experience filtering: "Visited by me", "Tried by friends", and "✨ Untried".
- **Collaborative Comments & Sharing Groups (Phase 5)**:
  - Recommendations and comments thread on each establishment card (`PlaceCommentsThread`).
  - Real-time commenting with timestamp, author (`@username`), and deletion controls.
  - Visibility scopes: quick toggle between `🌍 Community (All)` and `🔒 Private (Only me)` with server-side authorization.
  - Relational schema for sharing groups (`sharing_groups`, `sharing_group_members`).
- **PWA & Web Share Target**:
  - Installable PWA support on mobile and desktop (`manifest.json` and web app metadata).
  - Web Share Target receiving links directly from Google Maps or social media to the `/new` ingestion form.
- **Admin Dashboard Tools & Places Management**:
  - Direct manual user creation (`UsersManager`) with name, @username, email, password, and role.
  - Places table view (`PlacesTableManager`) with real-time filters and multi-select bulk delete.
  - Worldwide 20-place demo dataset with comments, statuses, ratings, and favorites for the administrator.
- **Adaptive UX & Navigation**:
  - Horizontal mouse scroll (`HorizontalScroll`) across occasions, status filters, and popular tags.
  - Responsive grid/row toggle for occasions.
  - Searchable expandable tags panel for large taxonomies.
- **PayPal Support & TVSpy-style Ecosystem Links**:
  - Subtle PayPal donation button (`paypal.me/alebupal`), GitHub repository, and Docker Hub links.
