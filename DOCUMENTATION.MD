# GastroMap User Guide & Documentation 🍽️

Welcome to the official user, administration, and architecture guide for **GastroMap**, the private self-hosted collaborative platform for discovering, organizing, and sharing gastronomic recommendations with friends and family.

---

## 📋 Table of Contents
1. [Prerequisites](#1-prerequisites)
2. [Quick Docker Deployment](#2-quick-docker-deployment)
3. [Initial Setup & First Admin](#3-initial-setup--first-admin)
4. [Modules & Features](#4-modules--features)
5. [Private Groups & Invitations](#5-private-groups--invitations)
6. [Interactive Map & Geolocation (PostGIS)](#6-interactive-map--geolocation-postgis)
7. [Import, Export & Backups](#7-import-export--backups)
8. [Multi-language System (i18n)](#8-multi-language-system-i18n)
9. [Security & Access Control](#9-security--access-control)
10. [Technical Architecture & Scalability](#10-technical-architecture--scalability)
11. [Frequently Asked Questions (FAQ)](#11-frequently-asked-questions-faq)

---

## 1. Prerequisites

- A server, mini-PC, NAS, or VPS running **Docker Engine** (24+) and **Docker Compose**.
- 512 MB minimum free RAM (1 GB recommended).
- Available host port:
  - `3000` (or your mapped external port, e.g. `3007:3000`).
- Optional: A reverse proxy such as **Nginx Proxy Manager**, **Traefik**, or **Caddy** for automated SSL/HTTPS.

---

## 2. Quick Docker Deployment

The recommended production deployment uses `docker-compose.yml`:

```yaml
services:
  db:
    image: postgis/postgis:16-3.4-alpine
    container_name: gastromap_db
    restart: unless-stopped
    environment:
      POSTGRES_DB: ${POSTGRES_DB:-gastromap}
      POSTGRES_USER: ${POSTGRES_USER:-gastromap}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-gastromap_secret}
    volumes:
      - ./data/pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-gastromap} -d ${POSTGRES_DB:-gastromap}"]
      interval: 5s
      timeout: 5s
      retries: 5

  app:
    image: alebupal/gastromap:latest
    container_name: gastromap_app
    restart: unless-stopped
    ports:
      - "3007:3000"
    environment:
      NODE_ENV: production
      DATABASE_URL: postgres://${POSTGRES_USER:-gastromap}:${POSTGRES_PASSWORD:-gastromap_secret}@db:5432/${POSTGRES_DB:-gastromap}
      SESSION_SECRET: ${SESSION_SECRET:-your_super_secret_string_minimum_32_characters}
      PORT: 3000
    depends_on:
      db:
        condition: service_healthy
```

Start containers in the background:
```bash
docker compose up -d
```

Access via browser at `http://YOUR_SERVER_IP:3007` or through your configured domain.

---

## 3. Initial Setup & First Admin

When launching on a clean database:

1. The application automatically redirects to `/setup`.
2. Configure your primary **Administrator Account**:
   - Full Name.
   - Username (`@username`).
   - Email address.
   - Password (hashed internally using **Argon2id**).
3. Once completed, **Open Public Registration (`/register`)** is enabled by default so anyone can create an account with their own **Personal Map** and create or join friend groups. If you prefer a closed instance, you can switch to **Invite Only** at any time from `/admin > Settings > Registration Mode`.

---

## 4. Modules & Features

### 🍽️ Gastronomic Explorer (Main View - Stitch UI/UX Design)
- **Unified Search, Command Palette (`Ctrl+K` / `⌘+K`) & Inline Action Pills**: Live search field with a `⌘K` button to launch the keyboard-navigable command palette (`↑`/`↓`, `Enter`, `Esc`), clear button, and inline quick action pills (`🎯 Assistant`, `🎲 Random`, `📦 Import`, `📍 Near me`, and prominent `➕ Add place`).
- **Segmented Experience Status Bar (Row 1) & Shareable Views**:
  - `🌐 All`: Global catalog filtered by user access.
  - `⭐ Favorites`: Starred places for instant recall.
  - `🕒 Want to go`: Wishlist of restaurants to visit.
  - `✅ Visited`: Places you have already attended.
  - `✨ To discover`: Places in the catalog you haven't visited yet.
  - Active filter chip with quick dismiss (`✕`), **«Share view»** button (copies the live URL synced with active filters `q`, `city`, `country`, `price`, `exp`, `occ`, `tag`), and `💾 Save` filter button.
- **Offline Write Queue & Automatic Sync**:
  - When offline or on unstable connections, you can still toggle favorites, update personal statuses (`Want to go` / `Visited`), and save private ratings or notes.
  - Pending mutations are stored in a persistent local queue (`IndexedDB`), surfaced via a discreet status banner, and automatically flushed in order when connectivity returns (or manually via `Sync now`).
- **Segmentation Filters (Row 2)**:
  - `Countries (195+)` and `Cities`: Searchable dropdown selectors.
  - `Price Ranges`: Segmented pills for explicit brackets (`< 20 €`, `20-30 €`, `30-40 €`, `> 40 €`).
  - `Minimum Rating`: Quick filter (`★ 7+`, `★ 8+`, `★ 9+`) inside the animated `+ Filters` panel, alongside categories and gastronomic tags (8 default plans customizable with emojis or **Material Symbols** icons in `/admin > Taxonomy`).
  - `Dining with friends`: Pick which users you're going out with (in `+ Filters` or the Decision Assistant / Mobile Filters) and choose from 11 modes with live descriptions (*Pending or untried*, *Everyone wants to go*, *Someone wants to go & untried*, *Someone wants to go even if visited*, *Someone's favorite*, *Everyone's favorite*, *Someone's favorite & new for others*, *Highly rated by someone (8+)*, *Tried by some & new for others*, *Visited by everyone*, or *Added by the group*). Works seamlessly with **🎲 Random Pick** and the map.
  - **Actionable Empty State**: When a filter combination yields 0 results, clickable chips let you remove any single active filter without resetting the entire search.
- **Stitch-styled Place Cards**:
  - Restaurant initials avatar, address with pin and **one-tap copy address button**, emerald price badge, and interactive favorite heart (`favorite`).
  - Horizontal collection action buttons (`Want to go`, `Visited`, `My note`) with tactile micro-interactions.
  - Card footer with author badge (showing `👻 @usuario_eliminado` for preserved contributions from deleted accounts) and complete actions (`Comments`, `Compare`, `Map`, `Google Maps`, **WhatsApp/Instagram share, copy text, or HMAC-signed public card link `/p/[id]` with Open Graph preview without exposing private notes or comments**, `Edit`, `Delete`).
- **«✨ For you (Your taste)» Sorting**:
  - Alongside date, rating, price, and distance sorting, **For you** scores places against your favorite, top-rated, and visited plans, tags, price brackets, and cities—surfacing matching unexplored venues first with a live taste summary banner.
- **Synced Interactive Map**:
  - Floating top-right badge displaying live count and a subtle radar pulse ring on the selected pin.
  - Default **«Scroll list»** mode on mobile for smooth scrolling without getting trapped inside the map.
  - Fully localized map popups matching the place card aesthetic.
- **Micro-Interactions, View Transitions & Modern Pagination**:
  - Smooth Light/Dark switching via the **View Transitions API**, sliding pill indicators on segmented controls, animated KPI counters, growing progress bars, shimmer skeletons, and circular pagination with custom dropdown selectors (`CustomSelect`), all respecting `prefers-reduced-motion`.

### 📱 Optimized Mobile Experience (Stitch Design)
- **Compact Header + Fixed Bottom Navigation (`MobileBottomNav`)**: Thumb-friendly navigation (`Explore`, `Add`, `Stats`, `Menu`), top search trigger for the command palette, and floating **`Add place` FAB**.
- **Map + Overlapping Bottom Sheet & Swipe-to-Close Modals**: Pill search bar with inline filter toggle and orange `List / Map` switch, horizontal quick chips with counts, a rounded white sheet («Featured Places») directly beneath the map, and **all user modals unified as bottom-sheets with a top drag handle and native swipe-down dismissal**.
- **Bottom Floating Card & Synchronized Jump**: Tapping any pin on the mobile map pops up a floating summary card with price, name, direct Google Maps directions (`🗺️ Directions`), and full details trigger. Tapping *"Full details →"* automatically navigates to the exact pagination page, switches views, and scrolls smoothly to the target card with a golden highlight ring.
- **Floating «Back to Top» Button**: Subtle, non-intrusive circular button with glassmorphism styling that appears smoothly when scrolling past 300px for instant one-tap scroll to header.
- **Smart Pagination**: Place listings feature a configurable page size selector (10, 20, 50, or All) and page buttons for ultra-responsive navigation.

### 🎲 Decision Assistant & Random Pick
- **🎲 Random Pick (Random Selector)**: Automatically picks a restaurant among currently filtered results when friends cannot agree, with options to view on the interactive map, open in Google Maps, or jump directly to its place card in the catalog list (`View in list`).
- **Decision Wizard**: Step-by-step guidance defining budget, mood, country, city, distance radius, and visit state.

### 💬 Collaborative Comments, Ratings & Detail Modals
- **Unified Comments & Private Note**: The comments modal brings together community reviews and your private note (visible only to you) with animated tabs (`All`, `Private`, `Community`), inline editing of your private note, and a mobile-friendly collapsible composer. Administrators can edit or delete any comment for moderation or fixes (tracked in the audit log).
- **Private Rating (`My rating`, 1 to 10)**: Dedicated quick modal to score any restaurant from 1 to 10.
- **Quick Actions & `⋮` Menu**: Each card displays clear footer actions (`Comments`, `Compare`, `Map`, `Google Maps` —using the official link or coordinates automatically when missing—, `Share`) plus a `⋮` menu with **Save to list**, **Copy / move to another space…**, **Search on Google**, `Edit`, and `Delete`.
- **Adding Places (`/new`)**:
  - **Destination Space Banner**: Displays *«Adding to…»* at the top with a quick selector (required when viewing *All my places*).
  - **Detect & Import**: If the venue already exists in another space you can access, offers to import its basic details (name, address, city, coordinates, Maps link) while keeping each group's plans, tags, and comments independent.
  - **Google Maps URL Validation**: Warns if a pasted URL is not a Google Maps link, offering **Remove link** (use coordinates only) or **Keep anyway** (the card still opens Maps via coordinates).
- **Side-by-Side Comparator (`⚖️`)**: Compare up to 3 places at once.
- **Personal Stats (`📊 Stats`) & «Wrapped»**: Filter your KPIs, **exploration progress** bar (*To discover* & `% visited`), and annual summary by **All my places**, **Personal Map**, or any **group**, plus a collapsible **My groups** breakdown showing your role, contributions, visits, and comments per group.

### 🔖 Shareable Lists & Collections (Personal Guides)
- **Themed Organization**: From the user menu (*My lists & guides*) or via `⋮ > Save to list` on any place card, organize places into themed collections such as *“Tapas tour in Granada”*, *“Lisbon trip”*, or *“Special dinners”*.
- **Manual Stop Ordering**: Expand any list in *My lists & guides* to reorder stops (`↑`/`↓`) or remove places without deleting them from the main catalog.
- **Read-Only Public Link (`/guide/[slug]`)**: Toggle any list to **Public** to generate a shareable link (with one-tap copy or WhatsApp share). Friends can browse the full guide with an interactive map, numbered stops, and a multi-stop **«Route in Google Maps»** button without registering or logging in. Switch the list back to **Private** at any time to immediately revoke public access.

---

## 5. Independent Spaces, Friend Groups & Personal Map

GastroMap organizes places into **100% isolated spaces**, so every group of friends works like its own dedicated app without mixing places or member lists across groups:

- **Header Workspace Switcher**:
  - **🏠 My Personal Map**: Strictly private space visible only to you (`group_id = NULL`).
  - **🍻 My Friend Groups**: Independent collaborative spaces (with custom name, emoji, description, and an automatic **quick search input** when you belong to more than 5 groups). When creating a group, choose **empty**, **8 default plans**, or **clone taxonomy** from another group.
  - **🌍 All my places**: Combined read view bringing together your Personal Map and all your groups, displaying each card's space badge and enabling the **Spaces** filter.
- **Copy or Move Places Across Spaces**: From `⋮ > Copy to another space…` (single) or `/admin` and `/group-admin` tables (bulk), copy or **move** places to another group or Personal Map. Duplicate detection lets you choose **Keep both** (`(copia)`), **Replace existing**, or **Skip**, with a 10-minute **Undo**.
- **Group Invitation Links & Join Requests (`/groups/join/[token]`)**:
  - Generate shareable links with **configurable expiry** (7 days, 30 days, or never-expiring), **usage limits (`maxUses`)**, and **early revocation**.
  - Enable **«Invite links require administrator approval»** so new joiners wait in a pending queue inside `/group-admin > Members` until approved or rejected.
  - New users opening an invite link can sign up at `/register` and are automatically redirected back to join the group.
- **Roles & Permissions (Built-In Legend)**:
  - **Global roles:** `SUPERADMIN` (first user created at `/setup`, full platform control) and `USER` (subsequent accounts with their private Personal Map).
  - **Per-group roles:** `CREATOR` (primary owner, can transfer ownership or delete the group), `GROUP ADMIN` (manages members, join requests, taxonomy, places, trash, and API), and `MEMBER` (adds places, comments, and tracks visits).
- **Per-Group Administration Panel (`/group-admin`) & Author Moderation**:
  - Group admins access `/group-admin` to manage **Group Statistics**, **Places** (bulk copy/move, duplicate merging, **Data health**, and **30-day Trash**), **Members, Join Requests & Invites**, **Group Plans & Tags** (collapsed by default), and **Settings** (**Export entire group**, **own encrypted Google Places API key**, and group deletion).
  - If a member leaves a group, their places and comments stay intact in the group. When deleting an account in `/admin > Users`, superadmins can preserve contributions under a **`👻 @usuario_eliminado` ghost account**, reassign them to each group owner, or purge them; admins can also **choose or reassign the author** when **adding (`/new`)** or editing any place or comment.
  - The global `/admin` dashboard remains exclusively for the instance **Superadministrator**.

---

## 6. Interactive Map & Geolocation (PostGIS)

- **PostGIS Geospatial Engine**: Stores coordinates as native `geography(Point, 4326)` with spatial index acceleration.
- **«Near me» Distance**: Calculates real-time distance using the Haversine formula on client and PostGIS on server.
- **Dynamic Spatial Clustering**: Clustered bubbles for high-density restaurant areas.
- **Zero-cost OSM Tiles**: Standard OpenStreetMap tiles out of the box (or custom CartoDB Voyager keys).
- **Google Maps Link Parser**: Follows shortened redirects (`maps.app.goo.gl`, `g.co/kgs`, `share.google`), extracts true coordinates and pre-fills place data.

---

## 7. Import, Export & Backups

In the **Import / Export** modal (`📦`):

### 📤 Export Formats
- **PDF (PDF 1.4 Standard)**: Native, dependency-free generator producing a printable A4 catalog with Helvetica typography, running headers, direct Google Maps link (`[View on Google Maps]`), clean price ranges, and dynamic pagination.
- **JSON**: Full structured data dump with tags and categories.
- **CSV**: Spreadsheet friendly format.
- **GeoJSON**: Standard GIS spatial format.
- **KML**: Google Earth / My Maps compatible.
- **GPX**: Waypoint format for Garmin, OsmAnd, or GPS devices.

### 📥 Import Formats
- Import `.json`, `.geojson`, `.kml`, `.gpx`, and `.csv` files (including **Google Takeout / Google Maps** exports in Spanish or English, automatically stripping UTF-8 BOM and recognizing accented headers such as `Título`, `Nota`, `Comentario`, `URL`, and `Etiquetas`) with automatic space-level deduplication by Google Maps URL or normalized name and interactive preview.
- **Downloadable Complete Sample Templates**: The import tab includes direct 1-click downloads for realistic, fully structured example documents in all 5 accepted formats (`JSON`, `CSV`, `GeoJSON`, `KML`, `GPX`), making it easy to verify the expected format before importing.
- **Occasions & Tags Auto-creation**: When importing places with categories or occasions, the system automatically registers them in the `occasions` and `tags` tables, ensuring filters and selectors are synchronized.
- **Automatic Linkification (LinkifiedText)**: Any URLs present in notes or comments are automatically rendered as secure clickable links.

### 🛡️ Backups and Advanced Administration (Admin `/admin`)
- **Dedicated Scalable 5-Section `/admin` Dashboard**: The Superadmin dashboard lives on its own protected `/admin` route with a persistent desktop sidebar (and mobile drawer) organized into 5 clear sections: **Overview** (KPIs + Top active groups), **Groups** (paginated directory with 1-click `/group-admin` shortcuts for each group's places, members, join requests, 30-day trash, export, own API key, and collapsed taxonomy), **Users** (accounts + Platform Invites sub-tab, «Groups & roles» modal, safe deletion with reassignment, and permissions legend), **Places** (global moderation with Space/Group filter, bulk copy with conflict resolution, and trash), and **System & Audit** (General & Access with API quotas, Demo Data, and Audit Log sub-tabs).
- **Clear Roles with Built-In Legend**: The first user created in `/setup` is a **SUPERADMIN** (full platform control). Subsequent users sign up as **USER** (with their private Personal Map) and become **CREATOR** or **GROUP ADMIN** only for groups they create or are promoted in. Both `/admin > Users` and `/group-admin > Members` feature a collapsible role legend explaining each permission level.
- **Real-Time Global Analytics**: 6 KPI cards, 30-day activity pulse banner, top contributors ranking, popular places grid, and distribution bars across cities, plans, prices, and tags.
- **Bulk Places Backup**: Checkbox selection in admin table to export JSON backups of selected places.
- **Selective Demo Cleanup**: Button to wipe only the 50 demo places and demo community users without affecting custom places.
- **Danger Zone — Reset Application**: Administrative wipe clearing all places, comments, groups, invitations, and collaborator accounts while preserving the current administrator account.
- **Full Database Backup & Restore**: One-click full JSON database export and restore from **Admin Dashboard > Settings > Backup** with audit logging (works seamlessly even on fresh `/setup` installs while preserving your active admin session and all relational IDs).
- **Log in as User (Secure Impersonation)**: From `/admin > Users`, administrators can click **«Log in as»** on any active account to experience GastroMap exactly as that user. A sticky top alert banner always shows the active account with a **«Log out»** button to return to `/admin`, logged in the audit trail.
- **Automatic Version & Update Alerts**: The app checks GitHub Releases (`/api/version`) automatically and shows an interactive header pill whenever a newer version is published. In `/admin > Settings`, you can view the installed version and trigger an immediate check with **«Check now»**.

---

## 8. Multi-language System (i18n)

- **Supported Languages**: Spanish (`es`) and English (`en`).
- **Header & Profile Selector**: Switch languages on the fly, persisted via secure cookie (`gastromap_lang`) and saved in user profile database (`users.locale`).
- **Spreadsheet Two-Way Sync**:
  - `src/locales/es.json` & `src/locales/en.json`.
  - `src/locales/translations.csv` (adding a language = adding a column).
- **CLI Commands**:
  ```bash
  npm run i18n:export   # Export JSON files to translations.csv
  npm run i18n:import   # Rebuild JSON files from translations.csv
  npm run i18n:check    # Audit missing translation keys
  ```

---

## 9. Security & Access Control

- **Argon2id Password Hashing**: Best-in-class cryptographic hashing resistant to GPU cracking.
- **In-Memory Rate Limiting**: Brute-force protection on `/login`, registration, and token validation.
- **Strict HTTP Headers**: CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, and Permissions-Policy.
- **Anti-SSRF Protection & Secure Cookies**: Shortened Google Maps URL resolution strictly validates official hostnames and blocks private/local IPs across redirects; `HttpOnly` cookies automatically enable `Secure` behind HTTPS reverse proxies (`x-forwarded-proto: https`).
- **Group Isolation**: Server actions verify group memberships before serving data.
- **Audit Logging (`audit_logs`)**: Permanent database audit trail of administrative changes.

---

## 10. Technical Architecture & Scalability

- **Single Source of Truth**: App version centralized in `package.json` consumed via `src/lib/version.ts`.
- **Visual Design & Identity (Stitch UI/UX)**: Interface powered by Plus Jakarta Sans typography, warm culinary palette, initials avatar badges, and segmented dual light/dark theme switcher.
- **Drizzle ORM & TypeScript**: Typed schema models and deterministic SQL migrations in `drizzle/`.
- **Offline PWA & Full Cache**: Service Worker (`/sw.js`) with offline caching for application assets, visited pages, and map tiles (`gastromap-tiles-v1`), enabling full catalog and map access without internet connection in rural areas, basements, or offline mode.
- **Automated Tests**: Native test runner via `npm test` verifying i18n, Haversine formulas, security, and GPX output.

---

## 11. Frequently Asked Questions (FAQ)

### How do I bump the application version?
Change `"version"` in [package.json](package.json). Header, footer, API, and services update automatically.

### How can I add a new language?
Run `npm run i18n:export`, add a new column to `translations.csv`, run `npm run i18n:import`, and register the locale code in `src/lib/i18n/config.ts`.
