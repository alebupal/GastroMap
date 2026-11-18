# Changelog GastroMap

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-11-18

### Added
- **Horizontal Mouse Scroll for Categories & Filters (`HorizontalScroll`)**:
  - Smooth horizontal scrolling using the vertical mouse wheel and click-and-drag mechanics on desktop.
  - Enabled on occasions/categories bar, experience status tabs, and popular tags.
- **Direct User Creation for Administrators**:
  - New form in the admin users dashboard (`UsersManager`) to manually create accounts with full name, @username, email, initial password, and role.
- **Enriched Worldwide Demo Seeder (`DemoPlacesSeeder`)**:
  - The 20-place demo dataset now seeds full admin interactions: favorites (⭐), experience status ('visited', 'pending'), ratings, private notes, and community comments.
- **PayPal Donation & Repository Links (TVSpy style)**:
  - Added subtle "Donate with PayPal" (`paypal.me/alebupal`) buttons and quick links to GitHub and Docker Hub in the footer and user header.
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
  - Installable PWA support (`manifest.json` and application metadata).
  - Web Share Target to receive links shared directly from Google Maps, Instagram, or mobile browsers into `/new`.

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
- **Geopositioning & Interactive Map (Phase 3)**:
  - Interactive Leaflet map with CartoDB Voyager tiles (`MapView.tsx` and `MapContainerWrapper.tsx` using SSR-safe dynamic loading).
  - Thematic vector map pins using `L.divIcon` with occasion-based color coding and category emojis (`createPlaceMarkerIcon`).
  - Informative floating popups displaying venue name, location, price level, notes, and direct GPS navigation link ("Cómo llegar ↗").
  - "Near Me" location mode using browser Geolocation API with dynamic radius selector (1 km, 2 km, 5 km, 10 km, or unlimited).
  - Spatial PostGIS queries utilizing geodesic distance calculations (`ST_Distance`) and radius filtering (`ST_DWithin`).
  - Relative distance badges displayed on place cards and map popups (`📍 350 m`, `📍 1.4 km`).
  - Unified explorer component (`PlacesExplorer.tsx`) featuring a seamless mobile view toggle ("🗺️ Mapa" / "📋 Lista") and bidirectional card-to-map focus.
  - Hierarchical location selector (Province ➔ Municipality) in `LocationPicker.tsx` with preloaded dataset (`spanishLocations.ts`, e.g. Granada ➔ Santa Fe, Armilla, Capital).
  - Smart address search with real-time autocompletion powered by OpenStreetMap / Nominatim API (`geocoding.ts`), auto-populating street, city, province, and exact GPS coordinates with a single click.
- **Licensing, Branding & AI Collaboration Guidelines**:
  - GNU General Public License v3.0 ([LICENSE](LICENSE)).
  - Clean vector SVG favicon ([public/icon.svg](public/icon.svg)).
  - Detailed contribution guides tailored for both AI agents and human contributors in [README.MD](README.MD) and [README_ES.MD](README_ES.MD).
  - Standardized Pull Request template ([.github/pull_request_template.md](.github/pull_request_template.md)).
- **Build Performance & Docker Caching**:
  - Added `.dockerignore` to streamline Docker build context and exclude large local directories.
  - Added BuildKit cache mounts in `Dockerfile` for npm downloads (`/root/.npm`) and Next.js compiler artifacts (`/app/.next/cache`).
  - Enabled GitHub Actions layer cache (`type=gha`, `mode=max`) across multi-architecture CI workflows.
