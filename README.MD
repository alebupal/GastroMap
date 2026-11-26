# GastroMap 🍽️

[Versión en Español](README_ES.MD)

[![Version](https://img.shields.io/badge/version-0.2.0-blue.svg)](https://github.com/alebupal/GastroMap/releases)
[![Docker Hub](https://img.shields.io/docker/pulls/alebupal/gastromap.svg)](https://hub.docker.com/r/alebupal/gastromap/)
[![Donate PayPal](https://img.shields.io/badge/Donate-PayPal-orange.svg)](https://www.paypal.me/alebupal)
[![License: GPL-3.0](https://img.shields.io/badge/License-GPLv3-blue.svg)](LICENSE)

**GastroMap** is a private, self-hosted web application to save, organize, discover, and decide where to eat, have tapas, or grab drinks with friends, partner, or family.

Built with a **mobile-first** approach and installable as a **PWA**, it lets you add places in seconds (even by sharing directly from Google Maps, Instagram, or TikTok) and solves the everyday question of *“Where should we go today?”* with guided distance, occasion, and budget filters, or by rolling a dice.

---

## ✨ Key Features

* **➕ Ultra-Fast Place Ingestion:**
  * Compatible with the **Web Share Target API**: Share a link directly from Google Maps or social networks and open the place card instantly on your phone.
  * Top banner showing the destination space (*«Adding to…»*), automatic cross-space detection to **import basic venue details**, Maps URL validation with coordinate-based mobile fallback, and a **Search on Google** shortcut on every card.
  * Optional **Google Places API (New)** enrichment with **per-group encrypted API keys**, configurable monthly quotas (`900/mo` global, `50/mo` per group), 30-day shared cache, and free OpenStreetMap + Open Graph fallback.
  * Fast classification across 8 default plans (*Breakfast / Brunch, Tapas / Drinks, Lunch / Dinner, Casual / Quick, Coffee / Dessert, Cocktails / Drinks, Date / Special, Groups / Celebration*) customizable with emojis or **Material Symbols** icons, plus price range (`€` to `€€€€` or `???` so unknown places aren't left out).

* **🔍 Main Explorer & Universal Search (Stitch UI/UX Design):**
  * **Unified search bar & Command Palette (`Ctrl+K` / `⌘+K`)**: Rounded search input with keyboard-driven `⌘K` quick launcher to jump to any place or action, plus inline quick action pills (`🎯 Assistant`, `🎲 Random`, `📦 Import`, `📍 Near me`, and `➕ Add place`).
  * **Segmented experience filters (Row 1) & Shareable Views**: Personal status tabs (`All`, `⭐ Favorites`, `🕒 Want to go`, `✅ Visited`, `✨ To discover`), live URL query param sync with a **«Share view»** button, active filter chip (`✕`), and `💾 Save` button.
  * **Two-tier segmentation (Row 2) & Dining with friends**: Searchable dropdowns for countries (+195) and cities (accent-insensitive search), explicit price range chips (`< 20 €`, `20-30 €`, `30-40 €`, `> 40 €`), quick **minimum rating filter** (`★ 7+`, `★ 8+`, `★ 9+`), **«Dining with friends»** filter to find places pending or untried for the friends you're meeting, featured tags with animated `+ Filters` panel, and actionable empty state with removable active-filter chips.
  * **Stitch-styled place cards**: Initials avatar, address with pin, emerald price badge, favorite button, collection buttons (`Want to go`, `Visited`, `My note`), **one-tap copy/share place info**, and author footer with actions.
  * **Modern pagination & synced map**: Circular pill buttons, live map floating count, and default **«Scroll list»** mode on mobile for effortless scrolling without getting trapped inside the map.

* **🗺️ Interactive Leaflet Map:**
  * Free, lightweight OpenStreetMap / CartoDB tiles (zero Google Maps API billing or quotas).
  * Dynamic marker clustering and color-coded status badges.

* **🌍 Independent Spaces, Friend Groups, Personal Map & Guides:**
  * Self-hosted on your own infrastructure (Docker), with **open public registration** (`/register`) or **invite-only mode** configurable in `/admin > System & Audit`.
  * **100% Isolated Multi-Space Architecture**: Every user gets **🏠 My Personal Map** (strictly private) and can create (empty, with 8 default plans, or cloning taxonomy from another group) or join unlimited **🍻 Friend Groups** via magic links (`/groups/join/[token]`) with optional admin approval. Each group operates like its own independent app with its own places, plans, tags, lists, **per-group admin panel (`/group-admin`)**, bulk copy/move across spaces with duplicate detection and **Undo**, **30-day Trash**, and a **Data health** tab—plus a combined **🌍 All my places** view and searchable header switcher.
  * **Shareable Lists & Personal Guides**: Curate themed collections (trips, tapas routes, special dinners), reorder stops manually, and toggle a **read-only public link** (`/guide/[slug]`) with an interactive map and Google Maps route that friends can browse without signing up.
  * Private personal notes and collaborative comments on each place, moderated by place authors and group administrators.

* **📊 Personal Statistics, Annual «Wrapped» & Scalable 5-Section Admin Panel (`/admin`):**
  * Personal stats dashboard (`📊 Stats`) with **space filtering** and **My groups** breakdown, plus an interactive annual **«Wrapped»** summary focused on places tried, favorites saved, catalog contributions, and reviews.
  * **Scalable 5-Section Superadmin Panel (`/admin`)** with Stitch sidebar navigation: **Overview** (KPIs + Top groups), **Groups** (paginated directory linking to `/group-admin`), **Users** (*«Groups & roles»* modal, permissions legend, safe user deletion with reassignment, and platform invites), **Places** (global moderation, bulk copy/move, **Data health**, and **Trash**), and **System & Audit** (API quotas, `v0.1.x`-compatible backups, demo seeder, and audit log).

* **⚖️ Comparator, Saved Filters & Import / Export:**
  * Side-by-side place comparator (`⚖️`) for up to 3 establishments.
  * Saved filter presets (`💾`) with persistent label, multi-criteria sorting, centered quick actions, and live searchable taxonomies with progressive «Show more» loading.
  * Export in **native PDF (printable A4), JSON, CSV, GeoJSON, KML, and GPX**; import from **JSON, GeoJSON, Google Takeout, KML, GPX, and CSV** with preview and downloadable sample templates.
  * Bulk place backup downloads directly from the admin management table.

* **🌐 Multi-language System (i18n):**
  * Full support for multiple languages (Spanish 🇪🇸 / English 🇬🇧) powered by JSON dictionaries and CSV sync architecture.
  * Custom scalable language dropdown (with built-in search for 6+ languages) across header, profile, and admin panels, plus CLI sync scripts (`npm run i18n:export`, `npm run i18n:import`, `npm run i18n:check`).

* **📱 Mobile Experience (PWA), Full Offline Cache & Dark/Light Mode:**
  * High-end visual redesign featuring **Plus Jakarta Sans** typography, segmented dual theme switcher, PWA status strip, and place cards with culinary initials avatars.
  * Native-feeling Stitch mobile UI featuring a pill search bar with `List / Map` toggle, horizontal quick chips, an overlapping **Bottom Sheet** below the map («Featured Places»), **bottom-sheet modals with native swipe-to-close gesture**, a floating **«Add place» FAB**, and a fixed **bottom navigation bar** (`Explore`, `Add`, `Stats`, `Menu`).
  * Quick action buttons (`🎯 Assistant`, `🎲 Random`, `📦 Import / Export`, `📍 Near me`) 100% justified in an adaptive grid to maximize full screen width.
  * Discreet floating «Back to Top» button with glassmorphism styling appearing smoothly after scrolling.
  * Installable on iOS and Android home screens as a Progressive Web App with **full Service Worker offline caching (`/sw.js`) and an offline write queue**: toggle favorites, update personal statuses (`Want to go` / `Visited`), and save private notes without connectivity, with automatic synchronization once back online.
  * Zero-flicker Dark and Light mode toggle (☀️ / 🌙) with persistent local storage.

* **🛡️ Security, Auditing & Backups:**
  * In-memory rate limiting against brute force attacks on authentication and tokens.
  * Strict security headers (CSP, X-Frame-Options, HSTS).
  * One-click full JSON database backup and restore from the admin dashboard (preserving the active admin session) with audit trail.

* **📚 In-App Documentation & Changelog (`/docs`):**
  * Official repository documentation and version changelog viewer directly within the app.
  * Real-time bilingual switcher (Spanish 🇪🇸 / English 🇬🇧) reading local files with GitHub Raw fallback.
  * **Automatic update alerts**: Checks GitHub Releases in the background and displays an interactive header pill whenever a newer version is published, plus a manual check button in `/admin > Settings`.

* **🛠️ Admin Dashboard & Database Integrity:**
  * Complete user management: create users directly, edit profile fields (name, @username, email, role, status), perform instant password resets, and use **«Log in as user»** (with a persistent top alert banner and one-click return to admin).
  * Advanced invitation registry: list all issued tokens with real-time status (Active 🟢, Used ✓, Expired ⏳), copy links on demand, and revoke invitations before their expiration date.
  * Paginated global places table with duplicate merging, bulk deletion, and an administrative **Audit Log** tracking critical actions.
  * Strict taxonomy management: dedicated Categories and Tags sections, bulk delete, and «🧹 Delete empty» with pre-confirmation modals.
  * Cascade deletion integrity: removing a place or user atomically purges all comments, notes, visits, and relational dependencies without leaving orphaned records.

---

## 🚀 Quick Deployment with Docker Compose

The easiest way to run GastroMap is using Docker Compose:

```yaml
services:
  db:
    image: postgis/postgis:16-3.4-alpine
    container_name: gastromap_db
    restart: unless-stopped
    environment:
      POSTGRES_DB: gastromap
      POSTGRES_USER: gastromap
      POSTGRES_PASSWORD: your_secure_password_here
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U gastromap -d gastromap"]
      interval: 5s
      timeout: 5s
      retries: 5

  app:
    image: alebupal/gastromap:latest
    container_name: gastromap_app
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      NODE_ENV: production
      DATABASE_URL: postgres://gastromap:your_secure_password_here@db:5432/gastromap
      SESSION_SECRET: change_this_secret_to_a_long_random_string
      PORT: 3000
    depends_on:
      db:
        condition: service_healthy

volumes:
  pgdata:
```

Start the stack with:
```bash
docker compose up -d
```

---

## 🛠️ Tech Stack

* **Frontend & Backend:** [Next.js 15](https://nextjs.org/) (App Router, Server Actions, TypeScript)
* **Database:** [PostgreSQL 16](https://www.postgresql.org/) with [PostGIS 3.4](https://postgis.net/) extension
* **ORM:** [Drizzle ORM](https://orm.drizzle.team/) + Drizzle Kit
* **UI & Styling:** [Tailwind CSS](https://tailwindcss.com/)
* **Maps:** [Leaflet](https://leafletjs.com/) + OpenStreetMap
* **CI/CD:** GitHub Actions with multi-arch building (`linux/amd64`, `linux/arm64`) for Docker Hub

---

## 🤝 How to Contribute (Step-by-Step Guide for Humans & AI Assistants)

Contributions are welcome! This guide is written with clear technical instructions so that **anyone can pass it directly to an AI coding assistant (Cursor, Claude Code, Copilot, ChatGPT, etc.) to perform the contribution end-to-end**.

### 🤖 AI Agent Quick Context
* **Architecture:** Full-stack monolith using Next.js 15 (App Router, strict TypeScript, Server Actions, and Server Components).
* **Database:** PostgreSQL 16 with PostGIS managed via Drizzle ORM (`src/db/schema.ts`).
* **UI:** Tailwind CSS with a mobile-first, touch-friendly design.
* **Auth:** Native PostgreSQL sessions (`sessions`) with secure HttpOnly cookies and Argon2id password hashing.

---

### 📋 Contribution Workflow

#### 1. Fork & Branch
Fork the repository on GitHub, clone it locally, and create a descriptive branch:
```bash
git clone https://github.com/YOUR_USERNAME/GastroMap.git
cd GastroMap

# For a new feature:
git checkout -b feature/short-description

# For a bugfix:
git checkout -b fix/short-description
```

#### 2. Start the Local Environment (1-Command Setup)
Install dependencies and launch the dev server:
```bash
npm install
npm run dev
```
*(This automatically boots the PostgreSQL/PostGIS container in Docker and starts Next.js on `http://localhost:3000`)*.

#### 3. Coding & Commit Guidelines
* **Strict Types:** All new code must be fully typed in TypeScript without unjustified `any`.
* **Database Changes:** If you modify `src/db/schema.ts`, generate and apply migrations:
  ```bash
  npm run db:generate
  npm run db:migrate
  ```
* **No Secrets or Private Files:** Never commit `.env` files or files inside `docs/`.
* **Conventional Commits:** Use standard prefixes:
  * `feat: ...` for new capabilities.
  * `fix: ...` for bug fixes.
  * `docs: ...` for documentation updates.
  * `refactor: ...` for code refactoring without behavior changes.
  * `style: ...` for UI/Tailwind polish.

#### 4. Mandatory Pre-Flight Verification
Before committing and pushing, ensure the build passes cleanly:
```bash
npm run build
```

---

### 🚀 Pull Request Template

1. Push your branch to GitHub:
   ```bash
   git push -u origin feature/short-description
   ```
2. Navigate to your fork on GitHub and click **Compare & pull request**.
3. Fill in the PR description using this template:

```markdown
### 📝 Description of Changes
A concise summary of what this PR introduces or fixes.

### 🎯 Motivation & Context
Why is this change needed? What user scenario or issue does it address?

### 🧪 How Was This Tested?
- [ ] Production build verified via `npm run build` without errors.
- [ ] Tested locally on `http://localhost:3000`.
- [ ] Verified on mobile/responsive viewport.
- [ ] Drizzle migrations generated and applied (if DB changed).

### 📸 Screenshots or Logs (optional)
*(Add if there are UI or visual updates)*
```

---

## ☕ Support the Project

If GastroMap helps you organize and discover delicious places, consider supporting its maintenance:

- ☕ **Donate with PayPal**: [paypal.me/alebupal](https://www.paypal.me/alebupal)
- ⭐ **Star the repository** on GitHub.
- 🐳 **Rate the image** on Docker Hub: [alebupal/gastromap](https://hub.docker.com/r/alebupal/gastromap/)

---

## 📄 License

This project is licensed under the GNU General Public License v3.0. See [LICENSE](LICENSE) for details.
