# Changelog GastroMap

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-11-26

Multi-space evolution of **GastroMap**: configurable open registration, a **private Personal Map** for every account, and **100% isolated friend groups** where each group works like its own self-contained app with independent places, categories, tags, lists, and group administrators.

### 🌍 Independent Spaces, Friend Groups & Personal Map
- **Total-Isolation Multi-Space Architecture**:
  - **🏠 My Personal Map**: Strictly private space (`group_id = NULL`) to save your own places, notes, and plans without sharing them with anyone.
  - **🍻 Isolated Friend Groups**: Any user can create unlimited friend groups (with custom name, emoji, and description) and invite friends via magic links (`/groups/join/[token]`). Each group owns an isolated catalog, its own customizable 8 default plans, scoped tags (`scope_key`), lists, and saved filters—never leaking places or member directories across groups.
  - **🌍 All my places**: Combined read view across your Personal Map and all your groups, featuring space badges on cards and a dedicated space filter.
- **Header Workspace Switcher**: Slack/Notion-style space switcher in the top header to jump in one click between any friend group, your Personal Map, or *All my places*.
- **Copy Place to Another Space (`📋 Copy to another space…`)**: Duplicate any restaurant as an independent copy into another group or your Personal Map (preserving your personal rating) without cross-linking comments across groups.
- **Automatic «Pinono» Migration**: Seamless migration moving all pre-existing `v0.1.0` users, places, occasions, tags, lists, and saved filters into the **«Pinono»** group.
- **Legacy v1 Per-Place Group Sharing Removed**: Dropped obsolete `place_group_access` and `place_user_access` tables and streamlined `getAllPlaces` down to 4 parallel batch queries.

### 🔓 Open Public Registration (`/register`) & `/admin` Toggle
- **Public Sign-Up Page (`/register`)**: Open registration with rate limiting, `callbackUrl` support for group invite links, and automatic Personal Map initialization.
- **Superadmin Registration Mode Toggle**: Instant switch in `/admin > Settings` between **Open Registration** and **Invite Only**.

### 🛡️ Per-Group Admin Panel (`/group-admin`) & Scalable 5-Section `/admin` Dashboard
- **Dedicated `/group-admin` Dashboard**: Group creators and promoted co-admins get their own group administration panel covering group analytics, places/duplicate merging, members/roles (`Creator` / `Group Admin` / `Member`), pending join-request approvals, revocable invite links, **30-day Places Trash**, **full group export**, **per-group Google Places API key**, and scoped plans/tags (collapsed by default).
- **Bulk Copy / Move Across Spaces with Duplicate Detection & Undo**: From `/admin > Places` and `/group-admin > Places` (and single-card copy), copy or **move** one or many places into another group or Personal Map choosing *Keep both* (`(copia)`), *Replace existing*, or *Skip*, with a 10-minute **Undo** action, plus a **Data health** tab to spot and fix invalid links, missing coordinates, or missing plans/cities.
- **Detect & Import Existing Venues**: When adding a place in `/new`, matches in your other spaces are surfaced so you can import basic details (name, address, city, coordinates, Maps link) while keeping each group's tags, plans, and comments independent, alongside a destination-space banner.
- **Safe User Deletion**: Deleting an account with group contributions prompts to reassign their places and comments to each group owner or purge them, blocking deletion of group owners until ownership is transferred.
- **Per-Group Google Places API, Quotas & Cache**: Groups can configure their own encrypted API key; otherwise they share the project key with configurable monthly quotas (`900/mo` global safety cap under the 1,000 free Enterprise tier, `50/mo` per group), a 30-day shared cache, and automatic OpenStreetMap fallback.
- **`v0.1.x` Backup Compatibility & Scalability**: Restoring legacy `v0.1.x` backups automatically migrates community places into a default «Grupo Principal» and ignores dropped columns; the header workspace switcher also adds a live search input when you belong to more than 5 groups.
- **Maps URL Validation & «Search on Google»**: Inline validation in `/new` and edit modals (*Remove link* / *Keep anyway*), coordinate-based Maps fallback on mobile, and a **Search on Google** action in each card's `⋮` menu.
- **Space-Scoped Personal Stats & Animated `SegmentedTabs`**: Space filter and *My groups* breakdown in `StatsModal`, compact role legend, and unified `SegmentedTabs` across all tab controls.
- **Scalable 5-Section `/admin` Restructuring**:
  - **📊 Overview** (default view): Global KPIs, Registration Mode badge, and **Top Active Groups** card with 1-click access to `/group-admin`.
  - **🍻 Groups**: Paginated, searchable, sortable directory with quick activity filters (`All`, `With places`, `Empty`), plans/tags count, inline group creation, and `Manage →` shortcut to each group's isolated `/group-admin` panel.
  - **👥 Users**: Sub-tabs for **Users** and **Platform Invites**, compact user rows with a **`🍻 N groups`** button opening the **«Groups & roles for @user»** modal (role changes, removals, adding to groups), plus a collapsible **role permissions legend** (`SUPERADMIN`, `USER`, `CREATOR`, `GROUP ADMIN`, `MEMBER`).
  - **📍 Places**: Global moderation table with searchable **Space / Group**, country, and city filters plus a dedicated sortable **Date** column.
  - **⚙️ System & Audit**: Unified sub-tabs for **General & Access**, **Demo Data**, and **Audit Log**.
- **Alphabetical Tag Merge & Sortable Admin Columns**:
  - **Tag & category merge/reassign selectors** are now sorted strictly alphabetically (`A-Z`) with place counts.
  - Clickable ascending/descending (`↑`/`↓`) sortable column headers across all admin tables.
- **Multi-Group UX & Card Refinements**:
  - **Alphabetically Sorted Searchable Selects (`SearchableSelect`)** matching trigger width across `/new`, `GroupsModal`, `/group-admin`, `/admin`, `StatsModal`, workspace switcher, and single/bulk place copy (`CopyPlaceModal` / `BulkCopyPlacesModal`).
  - **Accordion Groups Modal (`GroupsModal`)**: Collapsible group creation form, live search bar, and collapsed-by-default group cards to handle large group counts smoothly.
  - **Compact `PlaceCard` Badges & Collapsible Tags**: Context chips (group badge and dashed *To discover* badge) unified inline with categories and `#tags` via a subtle vertical divider, plus a 5-tag cap with **`+N more` / `Show less`**.
  - **Upgraded Statistics Across All 3 Tiers**: Exploration progress (*To discover* & `% visited`), collapsible *My groups* breakdown, and strict space filtering in `StatsModal`; 30-day pulse, group health shortcuts, and distributions in `/group-admin`; Google Places API usage and active/empty group counts in `/admin`.
  - **Full-Width `/docs` & `/new`**, plus unified footers across `/admin`, `/group-admin`, and the main app.

## [0.1.0] - 2026-11-25

Initial full release of **GastroMap**, a private, self-hosted web application to save, organize, discover, and decide where to eat, have tapas, or grab drinks.

### ✨ Explorer, Search & Smart Filters
- **Accent-Insensitive Universal Search**: Instantly searches across place name, city, address, description, private notes, tags, plans/occasions, comments, shared groups, and authors (matching real name, `username`, and `@username` for both place creators and commenters).
- **Command Palette (`Ctrl+K` / `⌘+K`)**: Full keyboard navigation (`↑`/`↓`, `Enter`, `Esc`) to jump directly to any place (list or map) or trigger quick actions.
- **Segmented Experience Bar with Sliding Pill**: Filter by `All`, `Favorites`, `Want to go`, `Visited`, and `To discover`, with two-way URL query sync and a **«Share view»** button.
- **Advanced Filters, Minimum Rating & «Dining with Friends»**:
  - Searchable dropdowns for countries (195+) and cities, explicit price brackets (`< 20 €`, `20-30 €`, `30-40 €`, `> 40 €`, `???`), minimum rating (`★ 7+`, `★ 8+`, `★ 9+`), 8 customizable default plans/occasions, and tags.
  - **«Dining with friends» Filter**: Pick which users you're meeting and filter places across **11 modes** (with icons and live descriptions): *Pending or untried*, *Everyone wants to go*, *Someone wants to go (untried)*, *Someone wants to go (even if visited)*, *Someone's favorite*, *Everyone's favorite*, *Someone's favorite, new for others*, *Highly rated by someone (8+)*, *Tried by some, new for others*, *Visited by everyone*, and *Added by the group*.
  - **Saved filters (`💾`)**, actionable empty state with removable chips, step-by-step **Decision Assistant**, **Indecision Mode (`🎲 Random`)**, and **Side-by-Side Comparator (`⚖️`)** for up to 3 places with multi-stop Google Maps routing.

### 🗺️ Interactive Map, Geolocation & Link Scraper
- **Leaflet Map with OpenStreetMap / PostGIS**: Dynamic spatial clustering, personal status pins, **«Near me»** distance calculation (configurable radius), instant focus release when clicking the map background, and default **«Scroll list»** mode on mobile.
- **Ultra-Fast Place Creation (`/new`) & Web Share Target**: Share links directly from Google Maps, Instagram, or TikTok; follows short redirects (`maps.app.goo.gl`, `g.co/kgs`, `share.google`), extracts coordinates, auto-suggests plans, ignores generic category descriptions (`"Bar"`, `"Restaurant"`), and detects street addresses so they are never used as the place name.
- **Optional Google Places API Enrichment**: Configurable API key in `/admin > Settings` with built-in setup guide and live test button, keeping OpenStreetMap / Nominatim as a free fallback.

### 🔖 Personal Collection, Shareable Lists & Comments
- **Per-User Private Collection**: Favorites, personal status (`Want to go` / `Visited`), dedicated private rating (`My rating`, 1 to 10), and inline-editable private notes visible only to their author.
- **Collaborative Comments**: Rich text reviews with auto-linkification, animated tabs (`All`, `Private`, `Community`), and mobile collapsible composer. Administrators can edit or delete any comment for moderation.
- **Shareable Lists & Personal Guides**: Organize places into themed collections (*“Tapas tour in Granada”*, *“Lisbon trip”*), reorder stops (`↑`/`↓`), and toggle a **read-only public link (`/guide/[slug]`)** accessible without signup featuring an interactive map, numbered stops, Open Graph metadata, and a multi-stop **«Route in Google Maps»** button.

### 👥 Private Groups, Invitations & Privacy
- **Invitation-Only Access**: Initial `/setup` wizard for the first administrator and private invitation tokens (`/invite/[token]`) with configurable expiry and early revocation.
- **Private Sharing Groups**: Create closed groups with join links (`/groups/join/[token]`), usage limits, configurable expiration, and cumulative server-side permission checks.

### 📱 Mobile Experience (PWA), Offline Mode & Micro-Interactions
- **Mobile-First Stitch Design**: Compact header, pill search bar with `List / Map` toggle, top map + overlapping *Bottom Sheet*, floating **«Add place» FAB**, fixed bottom navigation (`Explore`, `Add`, `Stats`, `Menu`), and all user modals unified as **bottom-sheets with a top drag handle and native swipe-to-close gesture**.
- **PWA with Offline Cache & Write Queue (IndexedDB)**: Installable on iOS/Android with Service Worker (`/sw.js`), idempotent offline write queue for favorites, statuses, and ratings with automatic sync on reconnect, and a **«Clear cache»** button.
- **Dark / Light Mode & Micro-Interactions**: Theme switching via the **View Transitions API**, **Plus Jakarta Sans** typography, unified **Google Material Symbols Outlined** iconography, sliding pills, animated KPI counters, and full `prefers-reduced-motion` support.

### 📊 Personal Statistics, Annual «Wrapped» & Import / Export
- **Stats Dashboard & Annual «Wrapped»**: Personal KPIs, top cities, specialties, and downloadable/shareable yearly summary card.
- **Multi-Format Import & Export**: Export to **native PDF (printable A4), JSON, CSV, GeoJSON, KML, and GPX**; import from **JSON, GeoJSON, Google Takeout, KML, GPX, and CSV** with duplicate detection, preview, and downloadable sample templates.

### 🛠️ Admin Panel (`/admin`), Audit Log & Backups
- **Dedicated `/admin` Dashboard**: Real-time global analytics, paginated places table (edit, duplicate merge, bulk delete, selective JSON backup), full user management, taxonomy manager (categories with emoji + Material Symbols picker, tags, merging, and empty cleanup), invitations, and selective demo data seeder/cleaner.
- **Log in as User (Secure Impersonation)**: **«Log in as»** button in `/admin > Users` with a sticky global **Top Alert** banner showing the active account and one-click return to your admin session.
- **Comprehensive Audit Log & Cleanup**: Full trail of critical actions (places, comments, users, invitations, groups, lists, settings, backups, and impersonations) with advanced search, readable labels, and purge buttons (`Clean > 30d`, `Clean > 90d`, `Clear all`).
- **Full JSON Backup & Restore (`/api/admin/backup`)**: One-click full database export and restore preserving the active administrator session (even across fresh installations with different UUIDs), plus a Danger Zone app reset tool.

### 🌐 Internationalization (i18n), Documentation & Versioning
- **Extensible Multi-Language System (Spanish / English)**: Over 1,000 keys synchronized across `es.json`, `en.json`, and `translations.csv` (`npm run i18n:export`, `i18n:import`, `i18n:check`) with a scalable `LanguageSelector`.
- **In-App Documentation Center (`/docs`)**: Full Markdown reader (badges, tables, links, heading anchors, syntax-labeled code blocks, and sliding-pill tabs) for *User Guide*, *Changelog*, and *README* in Spanish and English.
- **Automatic New-Version Alerts**: Background check against GitHub Releases (`/api/version`) with an animated header pill and a **«Version & Updates»** card with manual **«Check now»** button in `/admin > Settings`.

### 🛡️ Security & Architecture
- **Modern Stack & High-Performance Zero-N+1 Architecture**: Next.js 15 (App Router), TypeScript, Drizzle ORM, PostgreSQL + PostGIS (Docker), and Tailwind CSS, featuring 5 parallel `inArray` batch catalog queries, per-request deduplication (`React.cache`), atomic `UPSERT` with instant `0 ms` client sync (no full route revalidation) on personal micro-interactions, dynamic modal code-splitting (`next/dynamic`), and `React.memo` + `useDeferredValue` rendering optimizations.
- **Hardened Security & Automated Test Suite**: **Argon2id** password hashing, `HttpOnly` session cookies, in-memory rate limiting on auth endpoints, strict HTTP security headers (CSP, HSTS, X-Frame-Options), and automated tests covering units, engineering quality, backups, audit logs, impersonation, and public guides.
