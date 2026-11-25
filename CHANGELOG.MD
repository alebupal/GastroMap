# Changelog GastroMap

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
- **Modern Stack**: Next.js 15 (App Router), TypeScript, Drizzle ORM, PostgreSQL + PostGIS (Docker), and Tailwind CSS.
- **Hardened Security**: **Argon2id** password hashing, `HttpOnly` session cookies, in-memory rate limiting on auth endpoints, and strict HTTP security headers (CSP, HSTS, X-Frame-Options).
